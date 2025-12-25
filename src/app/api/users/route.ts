import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { withAuthAppRouter, withAdminAuthAppRouter } from '@/lib/auth';

// Get all users (admin only)
export const GET = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Connect to the database
    await connectToDatabase();

    // Get all users, excluding password field
    const users = await User.find({})
      .select('-password')
      .populate('assignedCompanies', 'name industry')
      .sort({ lastName: 1, firstName: 1 });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Create a new user (admin only)
export const POST = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const userData = await req.json();

    // Validate required fields
    if (!userData.username || !userData.email || !userData.password || !userData.role) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Check if username or email already exists
    const existingUser = await User.findOne({
      $or: [
        { username: userData.username },
        { email: userData.email }
      ]
    });
    
    if (existingUser) {
      return NextResponse.json(
        { message: 'Username or email already exists' },
        { status: 409 }
      );
    }

    // Validate role
    if (!['admin', 'user'].includes(userData.role)) {
      return NextResponse.json(
        { message: 'Invalid role. Role must be either "admin" or "user"' },
        { status: 400 }
      );
    }

    // Create the user
    const newUser = new User({
      username: userData.username,
      email: userData.email,
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      role: userData.role,
      assignedCompanies: userData.assignedCompanies || [],
      isActive: userData.isActive !== undefined ? userData.isActive : true
    });
    
    // Set password (this will be hashed by the User model pre-save hook)
    newUser.password = userData.password;
    
    await newUser.save();

    // Return user without password
    const userResponse = newUser.toObject();
    delete userResponse.password;

    return NextResponse.json(
      { message: 'User created successfully', user: userResponse },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
