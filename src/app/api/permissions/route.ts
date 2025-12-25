import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { withAdminAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

// Define available permissions in the system
const availablePermissions = {
  // User management
  'users.view': 'View users',
  'users.create': 'Create users',
  'users.update': 'Update users',
  'users.delete': 'Delete users',
  
  // Company management
  'companies.view': 'View companies',
  'companies.create': 'Create companies',
  'companies.update': 'Update companies',
  'companies.delete': 'Delete companies',
  
  // Warehouse management
  'warehouses.view': 'View warehouses',
  'warehouses.create': 'Create warehouses',
  'warehouses.update': 'Update warehouses',
  'warehouses.delete': 'Delete warehouses',
  
  // Assessment management
  'assessments.view': 'View assessments',
  'assessments.create': 'Create assessments',
  'assessments.update': 'Update assessments',
  'assessments.delete': 'Delete assessments',
  'assessments.assign': 'Assign users to assessments',
  
  // Questionnaire management
  'questionnaires.view': 'View questionnaires',
  'questionnaires.create': 'Create questionnaires',
  'questionnaires.update': 'Update questionnaires',
  'questionnaires.delete': 'Delete questionnaires',
  'questionnaires.respond': 'Respond to questionnaires',
  
  // ROI calculation management
  'roi.view': 'View ROI calculations',
  'roi.create': 'Create ROI calculations',
  'roi.update': 'Update ROI calculations',
  'roi.delete': 'Delete ROI calculations',
  
  // Recommendation management
  'recommendations.view': 'View recommendations',
  'recommendations.create': 'Create recommendations',
  'recommendations.update': 'Update recommendations',
  'recommendations.delete': 'Delete recommendations',
  
  // Report template management
  'reportTemplates.view': 'View report templates',
  'reportTemplates.create': 'Create report templates',
  'reportTemplates.update': 'Update report templates',
  'reportTemplates.delete': 'Delete report templates',
  
  // Report generation
  'reports.view': 'View reports',
  'reports.generate': 'Generate reports',
  'reports.delete': 'Delete reports',
  
  // Benchmark management
  'benchmarks.view': 'View benchmarks',
  'benchmarks.create': 'Create benchmarks',
  'benchmarks.update': 'Update benchmarks',
  'benchmarks.delete': 'Delete benchmarks',
  
  // Settings management
  'settings.view': 'View settings',
  'settings.update': 'Update settings',
  
  // Data import/export
  'data.export': 'Export data',
  'data.import': 'Import data',
  
  // Analytics
  'analytics.view': 'View analytics',
  'analytics.company': 'View company analytics',
  'analytics.assessment': 'View assessment analytics',
  
  // Audit logs
  'auditLogs.view': 'View audit logs',
  'auditLogs.delete': 'Delete audit logs',
  
  // Role management
  'roles.view': 'View roles',
  'roles.create': 'Create roles',
  'roles.update': 'Update roles',
  'roles.delete': 'Delete roles'
};

// Get all available permissions (admin only)
export const GET = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Connect to the database
    await connectToDatabase();

    // Group permissions by category
    const permissionsByCategory: Record<string, Record<string, string>> = {};
    
    Object.entries(availablePermissions).forEach(([key, description]) => {
      const category = key.split('.')[0];
      
      if (!permissionsByCategory[category]) {
        permissionsByCategory[category] = {};
      }
      
      permissionsByCategory[category][key] = description;
    });

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.SYSTEM,
      details: { component: 'permissions' },
      request: req
    });

    // Return permissions grouped by category
    return NextResponse.json({
      permissions: availablePermissions,
      permissionsByCategory
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
