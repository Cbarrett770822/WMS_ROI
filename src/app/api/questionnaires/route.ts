import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Questionnaire from '@/models/Questionnaire';
import { withAuthAppRouter, withAdminAuthAppRouter } from '@/lib/auth';

// Get all questionnaire templates
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const isActive = url.searchParams.get('isActive');
    const version = url.searchParams.get('version');
    
    // Connect to the database
    await connectToDatabase();

    let query: any = {};
    
    // Filter by active status if provided
    if (isActive !== null) {
      query.isActive = isActive === 'true';
    }
    
    // Filter by version if provided
    if (version) {
      query.version = version;
    }

    // Get questionnaires
    const questionnaires = await Questionnaire.find(query)
      .populate('createdBy', 'username firstName lastName')
      .sort({ version: -1, createdAt: -1 });

    return NextResponse.json({ questionnaires });
  } catch (error) {
    console.error('Error fetching questionnaires:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Create a new questionnaire template (admin only)
export const POST = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const questionnaireData = await req.json();

    // Validate required fields
    if (!questionnaireData.title || !questionnaireData.description || !questionnaireData.version || !questionnaireData.sections) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate sections structure
    if (!Array.isArray(questionnaireData.sections) || questionnaireData.sections.length === 0) {
      return NextResponse.json(
        { message: 'Questionnaire must have at least one section' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Check if questionnaire with same version already exists
    const existingQuestionnaire = await Questionnaire.findOne({
      version: questionnaireData.version,
      isActive: true
    });
    
    if (existingQuestionnaire) {
      return NextResponse.json(
        { message: 'An active questionnaire with this version already exists' },
        { status: 409 }
      );
    }

    // Create the questionnaire
    const questionnaire = new Questionnaire({
      ...questionnaireData,
      createdBy: user.userId
    });
    
    await questionnaire.save();

    return NextResponse.json(
      { message: 'Questionnaire created successfully', questionnaire },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating questionnaire:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
