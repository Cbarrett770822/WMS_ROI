import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Role from '@/models/Role';
import { withAdminAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

// Get all roles (admin only)
export const GET = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Connect to the database
    await connectToDatabase();

    // Get all roles
    const roles = await Role.find().sort({ name: 1 });

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.SYSTEM,
      details: { component: 'roles', count: roles.length },
      request: req
    });

    // Return roles
    return NextResponse.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Create a new role (admin only)
export const POST = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    
    // Validate required fields
    const { name, description, permissions } = body;
    
    if (!name || !Array.isArray(permissions)) {
      return NextResponse.json(
        { message: 'Name and permissions array are required' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Check if role with this name already exists
    const existingRole = await Role.findOne({ name });
    if (existingRole) {
      return NextResponse.json(
        { message: 'Role with this name already exists' },
        { status: 409 }
      );
    }

    // Create new role
    const role = new Role({
      name,
      description,
      permissions,
      isSystem: false, // Only system-created roles can be marked as system
      createdBy: user.userId
    });

    // Save role
    await role.save();

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.CREATE,
      entityType: EntityTypes.SYSTEM,
      entityId: role._id.toString(),
      details: { component: 'role', name: role.name },
      request: req
    });

    // Return success
    return NextResponse.json({
      message: 'Role created successfully',
      role
    });
  } catch (error) {
    console.error('Error creating role:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
