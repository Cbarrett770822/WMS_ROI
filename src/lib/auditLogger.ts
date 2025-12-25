/**
 * Utility for creating audit log entries throughout the application
 */

import { NextRequest } from 'next/server';
import AuditLog from '@/models/AuditLog';
import mongoose from 'mongoose';

interface AuditLogParams {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, any>;
  request?: NextRequest;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog({
  userId,
  action,
  entityType,
  entityId,
  details = {},
  request
}: AuditLogParams): Promise<mongoose.Document> {
  try {
    // Create new audit log entry
    const auditLog = new AuditLog({
      userId: new mongoose.Types.ObjectId(userId),
      action,
      entityType,
      entityId: entityId ? new mongoose.Types.ObjectId(entityId) : undefined,
      details,
      ipAddress: request ? (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown') : 'server',
      userAgent: request ? (request.headers.get('user-agent') || 'unknown') : 'server',
      timestamp: new Date()
    });

    // Save audit log
    await auditLog.save();
    return auditLog;
  } catch (error) {
    console.error('Error creating audit log:', error);
    throw error;
  }
}

/**
 * Common audit log actions
 */
export const AuditActions = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  LOGIN: 'login',
  LOGOUT: 'logout',
  EXPORT: 'export',
  IMPORT: 'import',
  GENERATE: 'generate',
  ASSIGN: 'assign',
  UNASSIGN: 'unassign',
  COMPLETE: 'complete',
  SUBMIT: 'submit',
  APPROVE: 'approve',
  REJECT: 'reject',
  CALCULATE: 'calculate'
};

/**
 * Common entity types
 */
export const EntityTypes = {
  USER: 'user',
  COMPANY: 'company',
  WAREHOUSE: 'warehouse',
  ASSESSMENT: 'assessment',
  QUESTIONNAIRE: 'questionnaire',
  QUESTIONNAIRE_RESPONSE: 'questionnaire_response',
  ROI_CALCULATION: 'roi_calculation',
  RECOMMENDATION: 'recommendation',
  REPORT_TEMPLATE: 'report_template',
  REPORT: 'report',
  BENCHMARK: 'benchmark',
  SETTING: 'setting',
  DATA: 'data',
  SYSTEM: 'system'
};
