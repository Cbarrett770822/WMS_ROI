import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { withAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

// Get current user's preferences
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Connect to the database
    await connectToDatabase();

    // Find the user
    const userDocument = await User.findById(user.userId).select('preferences');
    
    if (!userDocument) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    // Return preferences (or empty object if not set)
    return NextResponse.json({
      preferences: userDocument.preferences || {}
    });
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Update current user's preferences
export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    
    // Validate preferences
    const { preferences } = body;
    
    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { message: 'Preferences must be a valid object' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the user
    const userDocument = await User.findById(user.userId);
    
    if (!userDocument) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    // Merge existing preferences with new ones
    userDocument.preferences = {
      ...(userDocument.preferences || {}),
      ...preferences
    };

    // Save updated user
    await userDocument.save();

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UPDATE,
      entityType: EntityTypes.USER,
      entityId: user.userId,
      details: { 
        action: 'update-preferences',
        updatedKeys: Object.keys(preferences)
      },
      request: req
    });

    // Return updated preferences
    return NextResponse.json({
      message: 'Preferences updated successfully',
      preferences: userDocument.preferences
    });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Reset specific user preferences
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const keys = url.searchParams.get('keys')?.split(',') || [];
    const resetAll = url.searchParams.get('resetAll') === 'true';
    
    if (!resetAll && keys.length === 0) {
      return NextResponse.json(
        { message: 'Either specific keys or resetAll=true must be specified' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the user
    const userDocument = await User.findById(user.userId);
    
    if (!userDocument) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    // Handle preference reset
    if (resetAll) {
      // Reset all preferences
      userDocument.preferences = {};
    } else {
      // Reset only specified keys
      if (userDocument.preferences) {
        keys.forEach(key => {
          if (userDocument.preferences && userDocument.preferences.hasOwnProperty(key)) {
            delete userDocument.preferences[key];
          }
        });
      }
    }

    // Save updated user
    await userDocument.save();

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UPDATE,
      entityType: EntityTypes.USER,
      entityId: user.userId,
      details: { 
        action: 'reset-preferences',
        resetAll,
        keys: resetAll ? [] : keys
      },
      request: req
    });

    // Return updated preferences
    return NextResponse.json({
      message: resetAll ? 'All preferences reset successfully' : 'Specified preferences reset successfully',
      preferences: userDocument.preferences
    });
  } catch (error) {
    console.error('Error resetting user preferences:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
