import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { withAuthAppRouter } from '@/lib/auth';

export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Connect to the database
    await connectToDatabase();

    // Find the user (excluding password hash)
    const userProfile = await User.findById(user.userId)
      .select('-passwordHash')
      .populate('assignedCompanies', 'name industry');

    if (!userProfile) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    // Return user profile
    return NextResponse.json({
      user: {
        id: userProfile._id,
        username: userProfile.username,
        email: userProfile.email,
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        role: userProfile.role,
        assignedCompanies: userProfile.assignedCompanies,
        lastLogin: userProfile.lastLogin,
      },
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const { firstName, lastName, currentPassword, newPassword } = await req.json();

    // Connect to the database
    await connectToDatabase();

    // Find the user
    const userProfile = await User.findById(user.userId);

    if (!userProfile) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    // Update basic info
    if (firstName) userProfile.firstName = firstName;
    if (lastName) userProfile.lastName = lastName;

    // Update password if provided
    if (currentPassword && newPassword) {
      // Verify current password
      const isPasswordValid = await userProfile.comparePassword(currentPassword);
      if (!isPasswordValid) {
        return NextResponse.json(
          { message: 'Current password is incorrect' },
          { status: 400 }
        );
      }

      // Set new password
      userProfile.passwordHash = newPassword;
    }

    // Save changes
    await userProfile.save();

    // Return updated profile
    return NextResponse.json({
      message: 'Profile updated successfully',
      user: {
        id: userProfile._id,
        username: userProfile.username,
        email: userProfile.email,
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        role: userProfile.role,
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
