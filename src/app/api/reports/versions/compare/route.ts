import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Compare two versions of a report
 */
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/versions/compare');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { reportId, versionId1, versionId2, compareCurrentVersion = false } = body;
    
    // Validate required fields
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    if (!compareCurrentVersion && (!versionId1 || !mongoose.Types.ObjectId.isValid(versionId1))) {
      return sendError(req, 'Valid version ID for comparison is required', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId).lean();
    
    if (!report) {
      return sendError(req, 'Report not found', 404);
    }
    
    // Check if user has access to this report
    const isAdmin = user.role === 'admin';
    const isOwner = report.generatedBy.toString() === user.userId;
    const isSharedWithUser = report.sharedWith?.some((id: any) => id.toString() === user.userId);
    const isPublic = report.isPublic;
    
    if (!isAdmin && !isOwner && !isSharedWithUser && !isPublic) {
      return sendError(req, 'You do not have access to this report', 403);
    }
    
    // Get the first version (or current report state)
    let version1: any;
    if (compareCurrentVersion) {
      version1 = {
        _id: 'current',
        name: 'Current Version',
        sections: report.sections || [],
        createdAt: report.lastModified || report.createdAt
      };
    } else {
      version1 = report.versions?.find(
        (v: any) => v._id.toString() === versionId1
      );
      
      if (!version1) {
        return sendError(req, 'First version not found', 404);
      }
    }
    
    // Get the second version (optional)
    let version2: any;
    if (versionId2 && mongoose.Types.ObjectId.isValid(versionId2)) {
      version2 = report.versions?.find(
        (v: any) => v._id.toString() === versionId2
      );
      
      if (!version2) {
        return sendError(req, 'Second version not found', 404);
      }
    } else {
      // If no second version is specified, compare with current report state
      version2 = {
        _id: 'current',
        name: 'Current Version',
        sections: report.sections || [],
        createdAt: report.lastModified || report.createdAt
      };
    }
    
    // Compare the versions
    const comparison = compareVersions(version1, version2);
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.REPORT_VERSION,
      entityId: reportId,
      details: { 
        reportId, 
        versionId1: version1._id.toString(), 
        versionId2: version2._id.toString(),
        compareCurrentVersion
      },
      request: req
    });
    
    return sendSuccess(
      req,
      formatDocument({
        reportId,
        version1: {
          id: version1._id.toString(),
          name: version1.name,
          createdAt: version1.createdAt
        },
        version2: {
          id: version2._id.toString(),
          name: version2.name,
          createdAt: version2.createdAt
        },
        comparison
      }),
      'Version comparison completed successfully'
    );
  } catch (error) {
    logApiError('api/reports/versions/compare', error);
    return sendError(
      req, 
      `Error comparing report versions: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Compare two versions of a report and return the differences
 */
function compareVersions(version1: any, version2: any) {
  const result = {
    addedSections: [] as any[],
    removedSections: [] as any[],
    modifiedSections: [] as any[],
    summary: {
      totalSections: {
        version1: version1.sections?.length || 0,
        version2: version2.sections?.length || 0
      },
      addedCount: 0,
      removedCount: 0,
      modifiedCount: 0,
      unchangedCount: 0
    }
  };
  
  // Get section IDs from both versions
  const sections1 = version1.sections || [];
  const sections2 = version2.sections || [];
  
  const sectionIds1 = new Set(sections1.map((s: any) => s.id?.toString()));
  const sectionIds2 = new Set(sections2.map((s: any) => s.id?.toString()));
  
  // Find added sections (in version2 but not in version1)
  for (const section of sections2) {
    if (!sectionIds1.has(section.id?.toString())) {
      result.addedSections.push({
        id: section.id,
        title: section.title,
        type: section.type
      });
      result.summary.addedCount++;
    }
  }
  
  // Find removed sections (in version1 but not in version2)
  for (const section of sections1) {
    if (!sectionIds2.has(section.id?.toString())) {
      result.removedSections.push({
        id: section.id,
        title: section.title,
        type: section.type
      });
      result.summary.removedCount++;
    }
  }
  
  // Find modified sections (in both versions but with differences)
  for (const section1 of sections1) {
    if (sectionIds2.has(section1.id?.toString())) {
      const section2 = sections2.find((s: any) => s.id?.toString() === section1.id?.toString());
      
      // Deep compare the sections
      const differences = compareSections(section1, section2);
      
      if (differences.hasChanges) {
        result.modifiedSections.push({
          id: section1.id,
          title: section1.title,
          type: section1.type,
          differences
        });
        result.summary.modifiedCount++;
      } else {
        result.summary.unchangedCount++;
      }
    }
  }
  
  return result;
}

/**
 * Compare two sections and return the differences
 */
function compareSections(section1: any, section2: any) {
  const result = {
    hasChanges: false,
    titleChanged: false,
    contentChanged: false,
    dataChanged: false,
    metadataChanged: false,
    changes: {
      title: null as any,
      content: null as any,
      data: [] as any[],
      metadata: [] as any[]
    }
  };
  
  // Compare title
  if (section1.title !== section2.title) {
    result.hasChanges = true;
    result.titleChanged = true;
    result.changes.title = {
      from: section1.title,
      to: section2.title
    };
  }
  
  // Compare content
  if (section1.content !== section2.content) {
    result.hasChanges = true;
    result.contentChanged = true;
    result.changes.content = {
      from: section1.content,
      to: section2.content
    };
  }
  
  // Compare data (if exists)
  if (section1.data || section2.data) {
    const data1 = section1.data || {};
    const data2 = section2.data || {};
    
    // Get all keys from both objects
    const allKeys = new Set([...Object.keys(data1), ...Object.keys(data2)]);
    
    for (const key of allKeys) {
      // Check if the key exists in both objects
      const inData1 = key in data1;
      const inData2 = key in data2;
      
      // If key exists in only one object or values are different
      if (!inData1 || !inData2 || !deepEqual(data1[key], data2[key])) {
        result.hasChanges = true;
        result.dataChanged = true;
        result.changes.data.push({
          key,
          from: inData1 ? data1[key] : null,
          to: inData2 ? data2[key] : null,
          changeType: !inData1 ? 'added' : !inData2 ? 'removed' : 'modified'
        });
      }
    }
  }
  
  // Compare metadata (if exists)
  if (section1.metadata || section2.metadata) {
    const metadata1 = section1.metadata || {};
    const metadata2 = section2.metadata || {};
    
    // Get all keys from both objects
    const allKeys = new Set([...Object.keys(metadata1), ...Object.keys(metadata2)]);
    
    for (const key of allKeys) {
      // Check if the key exists in both objects
      const inMetadata1 = key in metadata1;
      const inMetadata2 = key in metadata2;
      
      // If key exists in only one object or values are different
      if (!inMetadata1 || !inMetadata2 || !deepEqual(metadata1[key], metadata2[key])) {
        result.hasChanges = true;
        result.metadataChanged = true;
        result.changes.metadata.push({
          key,
          from: inMetadata1 ? metadata1[key] : null,
          to: inMetadata2 ? metadata2[key] : null,
          changeType: !inMetadata1 ? 'added' : !inMetadata2 ? 'removed' : 'modified'
        });
      }
    }
  }
  
  return result;
}

/**
 * Deep equality check for objects
 */
function deepEqual(obj1: any, obj2: any): boolean {
  // If both are primitive types or one is null/undefined
  if (obj1 === obj2) return true;
  if (obj1 === null || obj2 === null) return false;
  if (obj1 === undefined || obj2 === undefined) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
  
  // If one is array and the other is not
  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;
  
  // If both are arrays
  if (Array.isArray(obj1)) {
    if (obj1.length !== obj2.length) return false;
    
    for (let i = 0; i < obj1.length; i++) {
      if (!deepEqual(obj1[i], obj2[i])) return false;
    }
    
    return true;
  }
  
  // If both are objects
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }
  
  return true;
}
