import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Role from '@/models/Role';
import User from '@/models/User';
import { withAdminAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import mongoose from 'mongoose';

// Get a specific role (admin only)
export const GET = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const roleId = req.url.split('/').pop();
    
    if (!roleId || !mongoose.Types.ObjectId.isValid(roleId)) {
      return NextResponse.json(
        { message: 'Invalid role ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the role
    const role = await Role.findById(roleId);
      
    if (!role) {
      return NextResponse.json(
        { message: 'Role not found' },
        { status: 404 }
      );
    }

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.SYSTEM,
      entityId: role._id.toString(),
      details: { component: 'role', name: role.name },
      request: req
    });

    // Return the role
    return NextResponse.json(role);
  } catch (error) {
    console.error('Error fetching role:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Update a specific role (admin only)
export const PUT = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const roleId = req.url.split('/').pop();
    
    if (!roleId || !mongoose.Types.ObjectId.isValid(roleId)) {
      return NextResponse.json(
        { message: 'Invalid role ID' },
        { status: 400 }
      );
    }

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

    // Find the role
    const role = await Role.findById(roleId);
    
    if (!role) {
      return NextResponse.json(
        { message: 'Role not found' },
        { status: 404 }
      );
    }

    // Prevent modification of system roles
    if (role.isSystem) {
      return NextResponse.json(
        { message: 'System roles cannot be modified' },
        { status: 403 }
      );
    }

    // Check if another role with this name already exists
    const existingRole = await Role.findOne({ name, _id: { $ne: roleId } });
    if (existingRole) {
      return NextResponse.json(
        { message: 'Another role with this name already exists' },
        { status: 409 }
      );
    }

    // Update role
    role.name = name;
    role.description = description;
    role.permissions = permissions;
    role.updatedAt = new Date();
    role.updatedBy = user.userId;

    // Save role
    await role.save();

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UPDATE,
      entityType: EntityTypes.SYSTEM,
      entityId: role._id.toString(),
      details: { component: 'role', name: role.name },
      request: req
    });

    // Return success
    return NextResponse.json({
      message: 'Role updated successfully',
      role
    });
  } catch (error) {
    console.error('Error updating role:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete a specific role (admin only)
export const DELETE = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const roleId = req.url.split('/').pop();
    
    if (!roleId || !mongoose.Types.ObjectId.isValid(roleId)) {
      return NextResponse.json(
        { message: 'Invalid role ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the role
    const role = await Role.findById(roleId);
    
    if (!role) {
      return NextResponse.json(
        { message: 'Role not found' },
        { status: 404 }
      );
    }

    // Prevent deletion of system roles
    if (role.isSystem) {
      return NextResponse.json(
        { message: 'System roles cannot be deleted' },
        { status: 403 }
      );
    }

    // Check if any users are using this role
    const usersWithRole = await User.countDocuments({ role: roleId });
    if (usersWithRole > 0) {
      return NextResponse.json(
        { message: `Cannot delete role that is assigned to ${usersWithRole} users` },
        { status: 409 }
      );
    }

    // Delete the role
    await Role.findByIdAndDelete(roleId);

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.DELETE,
      entityType: EntityTypes.SYSTEM,
      entityId: roleId,
      details: { component: 'role', name: role.name },
      request: req
    });

    // Return success
    return NextResponse.json({
      message: 'Role deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
