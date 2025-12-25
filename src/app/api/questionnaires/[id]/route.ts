import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Questionnaire from '@/models/Questionnaire';
import { withAuthAppRouter, withAdminAuthAppRouter } from '@/lib/auth';
import mongoose from 'mongoose';

// Get a specific questionnaire
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const questionnaireId = req.url.split('/').pop();
    
    if (!questionnaireId || !mongoose.Types.ObjectId.isValid(questionnaireId)) {
      return NextResponse.json(
        { message: 'Invalid questionnaire ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the questionnaire
    const questionnaire = await Questionnaire.findById(questionnaireId)
      .populate('createdBy', 'username firstName lastName');
      
    if (!questionnaire) {
      return NextResponse.json(
        { message: 'Questionnaire not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ questionnaire });
  } catch (error) {
    console.error('Error fetching questionnaire:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Update a questionnaire (admin only)
export const PUT = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const questionnaireId = req.url.split('/').pop();
    const updateData = await req.json();
    
    if (!questionnaireId || !mongoose.Types.ObjectId.isValid(questionnaireId)) {
      return NextResponse.json(
        { message: 'Invalid questionnaire ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the questionnaire
    const questionnaire = await Questionnaire.findById(questionnaireId);
    if (!questionnaire) {
      return NextResponse.json(
        { message: 'Questionnaire not found' },
        { status: 404 }
      );
    }

    // Validate sections structure if provided
    if (updateData.sections && (!Array.isArray(updateData.sections) || updateData.sections.length === 0)) {
      return NextResponse.json(
        { message: 'Questionnaire must have at least one section' },
        { status: 400 }
      );
    }

    // If version is being changed, check for conflicts
    if (updateData.version && updateData.version !== questionnaire.version) {
      const existingQuestionnaire = await Questionnaire.findOne({
        version: updateData.version,
        isActive: true,
        _id: { $ne: questionnaireId }
      });
      
      if (existingQuestionnaire) {
        return NextResponse.json(
          { message: 'An active questionnaire with this version already exists' },
          { status: 409 }
        );
      }
    }

    // Update the questionnaire
    Object.assign(questionnaire, updateData);
    await questionnaire.save();

    return NextResponse.json({
      message: 'Questionnaire updated successfully',
      questionnaire
    });
  } catch (error) {
    console.error('Error updating questionnaire:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete a questionnaire (admin only)
export const DELETE = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const questionnaireId = req.url.split('/').pop();
    
    if (!questionnaireId || !mongoose.Types.ObjectId.isValid(questionnaireId)) {
      return NextResponse.json(
        { message: 'Invalid questionnaire ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the questionnaire
    const questionnaire = await Questionnaire.findById(questionnaireId);
    if (!questionnaire) {
      return NextResponse.json(
        { message: 'Questionnaire not found' },
        { status: 404 }
      );
    }

    // Delete the questionnaire
    await Questionnaire.findByIdAndDelete(questionnaireId);

    return NextResponse.json({
      message: 'Questionnaire deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting questionnaire:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
