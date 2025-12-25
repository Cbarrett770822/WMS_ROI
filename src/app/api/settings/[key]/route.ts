import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Setting from '@/models/Setting';
import { withAuthAppRouter, withAdminAuthAppRouter } from '@/lib/auth';

// Get a specific setting
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Get key and scope from URL
    const key = req.url.split('/').pop();
    const url = new URL(req.url);
    const scope = url.searchParams.get('scope') || 'public';
    const userId = url.searchParams.get('userId');
    
    if (!key) {
      return NextResponse.json(
        { message: 'Setting key is required' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Build query
    const query: any = { key, scope };
    
    // Handle user-specific settings
    if (scope === 'user') {
      // If admin is requesting a specific user's setting
      if (user.role === 'admin' && userId) {
        query.userId = userId;
      } else {
        // Regular users can only access their own settings
        query.userId = user.userId;
      }
    } else if (scope === 'system' && user.role !== 'admin') {
      // Only admins can access system settings
      return NextResponse.json(
        { message: 'Unauthorized to access system settings' },
        { status: 403 }
      );
    }

    // Find the setting
    const setting = await Setting.findOne(query);
      
    if (!setting) {
      return NextResponse.json(
        { message: 'Setting not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ setting });
  } catch (error) {
    console.error('Error fetching setting:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Update a setting
export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Get key from URL
    const key = req.url.split('/').pop();
    const updateData = await req.json();
    
    if (!key) {
      return NextResponse.json(
        { message: 'Setting key is required' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Get scope and userId from request body
    const scope = updateData.scope || 'public';
    const userId = updateData.userId;

    // Build query
    const query: any = { key, scope };
    
    // Handle user-specific settings
    if (scope === 'user') {
      // If admin is updating a specific user's setting
      if (user.role === 'admin' && userId) {
        query.userId = userId;
      } else {
        // Regular users can only update their own settings
        query.userId = user.userId;
      }
    } else if ((scope === 'system' || scope === 'public') && user.role !== 'admin') {
      // Only admins can update system or public settings
      return NextResponse.json(
        { message: 'Unauthorized to update system or public settings' },
        { status: 403 }
      );
    }

    // Find the setting
    const setting = await Setting.findOne(query);
    
    if (!setting) {
      return NextResponse.json(
        { message: 'Setting not found' },
        { status: 404 }
      );
    }

    // Update the setting
    if (updateData.value !== undefined) {
      setting.value = updateData.value;
    }
    
    if (updateData.description !== undefined) {
      setting.description = updateData.description;
    }
    
    if (updateData.dataType !== undefined) {
      setting.dataType = updateData.dataType;
    }
    
    setting.lastModifiedBy = user.userId;
    setting.lastModifiedAt = new Date();
    
    await setting.save();

    return NextResponse.json({
      message: 'Setting updated successfully',
      setting
    });
  } catch (error) {
    console.error('Error updating setting:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete a setting (admin only for system and public settings)
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Get key and scope from URL
    const key = req.url.split('/').pop();
    const url = new URL(req.url);
    const scope = url.searchParams.get('scope') || 'public';
    const userId = url.searchParams.get('userId');
    
    if (!key) {
      return NextResponse.json(
        { message: 'Setting key is required' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Build query
    const query: any = { key, scope };
    
    // Handle user-specific settings
    if (scope === 'user') {
      // If admin is deleting a specific user's setting
      if (user.role === 'admin' && userId) {
        query.userId = userId;
      } else {
        // Regular users can only delete their own settings
        query.userId = user.userId;
      }
    } else if ((scope === 'system' || scope === 'public') && user.role !== 'admin') {
      // Only admins can delete system or public settings
      return NextResponse.json(
        { message: 'Unauthorized to delete system or public settings' },
        { status: 403 }
      );
    }

    // Find and delete the setting
    const result = await Setting.deleteOne(query);
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { message: 'Setting not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Setting deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting setting:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
