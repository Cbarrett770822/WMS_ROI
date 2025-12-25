import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Setting from '@/models/Setting';
import { withAuthAppRouter, withAdminAuthAppRouter } from '@/lib/auth';

// Get all settings (filtered by scope)
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const scope = url.searchParams.get('scope');
    
    // Connect to the database
    await connectToDatabase();

    let query: any = {};
    
    // Filter by scope if provided
    if (scope) {
      query.scope = scope;
    }

    // Regular users can only access public and user-specific settings
    if (user.role !== 'admin') {
      query.$or = [
        { scope: 'public' },
        { scope: 'user', userId: user.userId }
      ];
    }

    // Get settings
    const settings = await Setting.find(query).sort({ scope: 1, key: 1 });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Create a new setting (admin only for system and public settings)
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const settingData = await req.json();

    // Validate required fields
    if (!settingData.key || !settingData.value || !settingData.scope) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Validate scope
    if (!['system', 'public', 'user'].includes(settingData.scope)) {
      return NextResponse.json(
        { message: 'Invalid scope. Scope must be one of: system, public, user' },
        { status: 400 }
      );
    }

    // Check permissions based on scope
    if ((settingData.scope === 'system' || settingData.scope === 'public') && user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Only administrators can create system or public settings' },
        { status: 403 }
      );
    }

    // For user scope, ensure userId is set to current user if not admin
    if (settingData.scope === 'user') {
      if (user.role !== 'admin' || !settingData.userId) {
        settingData.userId = user.userId;
      }
    } else {
      // For non-user scopes, userId should be null
      settingData.userId = null;
    }

    // Check if setting with same key and scope already exists
    const query: any = { key: settingData.key, scope: settingData.scope };
    if (settingData.scope === 'user') {
      query.userId = settingData.userId;
    }

    const existingSetting = await Setting.findOne(query);
    
    if (existingSetting) {
      return NextResponse.json(
        { message: 'A setting with this key and scope already exists' },
        { status: 409 }
      );
    }

    // Create the setting
    const setting = new Setting({
      key: settingData.key,
      value: settingData.value,
      scope: settingData.scope,
      userId: settingData.userId,
      description: settingData.description || '',
      dataType: settingData.dataType || 'string',
      createdBy: user.userId,
      createdAt: new Date()
    });
    
    await setting.save();

    return NextResponse.json(
      { message: 'Setting created successfully', setting },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating setting:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
