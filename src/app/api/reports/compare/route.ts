import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import mongoose from 'mongoose';

// Helper function to check if user has access to a report
async function hasReportAccess(userId: string, report: any, isAdmin: boolean) {
  // Admin has access to all reports
  if (isAdmin) return true;
  
  // Creator has access
  if (report.generatedBy.toString() === userId) return true;
  
  // Users with whom the report is shared have access
  if (report.sharedWith?.some((id: any) => id.toString() === userId)) return true;
  
  return false;
}

// Compare reports or report versions
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const { 
      sourceReportId, 
      targetReportId, 
      sourceVersionId, 
      targetVersionId,
      comparisonType
    } = await req.json();
    
    // Validate required fields
    if (!sourceReportId || !mongoose.Types.ObjectId.isValid(sourceReportId)) {
      return NextResponse.json(
        { message: 'Valid source report ID is required' },
        { status: 400 }
      );
    }
    
    // Validate comparison type
    if (!comparisonType || !['reports', 'versions', 'current-vs-version'].includes(comparisonType)) {
      return NextResponse.json(
        { message: 'Valid comparison type is required (reports, versions, or current-vs-version)' },
        { status: 400 }
      );
    }
    
    // Additional validation based on comparison type
    if (comparisonType === 'reports' && (!targetReportId || !mongoose.Types.ObjectId.isValid(targetReportId))) {
      return NextResponse.json(
        { message: 'Valid target report ID is required for report comparison' },
        { status: 400 }
      );
    }
    
    if (comparisonType === 'versions' && 
        (!sourceVersionId || !mongoose.Types.ObjectId.isValid(sourceVersionId) ||
         !targetVersionId || !mongoose.Types.ObjectId.isValid(targetVersionId))) {
      return NextResponse.json(
        { message: 'Valid source and target version IDs are required for version comparison' },
        { status: 400 }
      );
    }
    
    if (comparisonType === 'current-vs-version' && 
        (!sourceVersionId || !mongoose.Types.ObjectId.isValid(sourceVersionId))) {
      return NextResponse.json(
        { message: 'Valid version ID is required for current-vs-version comparison' },
        { status: 400 }
      );
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the source report
    const sourceReport = await Report.findById(sourceReportId).lean();
      
    if (!sourceReport) {
      return NextResponse.json(
        { message: 'Source report not found' },
        { status: 404 }
      );
    }
    
    // Check if user has access to the source report
    const hasAccessToSource = await hasReportAccess(
      user.userId,
      sourceReport,
      user.role === 'admin'
    );
    
    if (!hasAccessToSource) {
      return NextResponse.json(
        { message: 'You do not have access to the source report' },
        { status: 403 }
      );
    }
    
    let targetReport;
    let sourceSections;
    let targetSections;
    let sourceMetadata = {
      name: sourceReport.name,
      id: sourceReport._id
    };
    let targetMetadata = {};
    
    // Process based on comparison type
    switch (comparisonType) {
      case 'reports':
        // Compare two different reports
        targetReport = await Report.findById(targetReportId).lean();
        
        if (!targetReport) {
          return NextResponse.json(
            { message: 'Target report not found' },
            { status: 404 }
          );
        }
        
        // Check if user has access to the target report
        const hasAccessToTarget = await hasReportAccess(
          user.userId,
          targetReport,
          user.role === 'admin'
        );
        
        if (!hasAccessToTarget) {
          return NextResponse.json(
            { message: 'You do not have access to the target report' },
            { status: 403 }
          );
        }
        
        sourceSections = sourceReport.sections || [];
        targetSections = targetReport.sections || [];
        targetMetadata = {
          name: targetReport.name,
          id: targetReport._id
        };
        break;
        
      case 'versions':
        // Compare two versions of the same report
        const sourceVersion = sourceReport.versions?.find(v => v._id.toString() === sourceVersionId);
        const targetVersion = sourceReport.versions?.find(v => v._id.toString() === targetVersionId);
        
        if (!sourceVersion) {
          return NextResponse.json(
            { message: 'Source version not found' },
            { status: 404 }
          );
        }
        
        if (!targetVersion) {
          return NextResponse.json(
            { message: 'Target version not found' },
            { status: 404 }
          );
        }
        
        sourceSections = sourceVersion.sections || [];
        targetSections = targetVersion.sections || [];
        sourceMetadata = {
          ...sourceMetadata,
          versionName: sourceVersion.name,
          versionId: sourceVersion._id,
          createdAt: sourceVersion.createdAt
        };
        targetMetadata = {
          ...sourceMetadata,
          versionName: targetVersion.name,
          versionId: targetVersion._id,
          createdAt: targetVersion.createdAt
        };
        break;
        
      case 'current-vs-version':
        // Compare current report state with a specific version
        const version = sourceReport.versions?.find(v => v._id.toString() === sourceVersionId);
        
        if (!version) {
          return NextResponse.json(
            { message: 'Version not found' },
            { status: 404 }
          );
        }
        
        sourceSections = sourceReport.sections || [];
        targetSections = version.sections || [];
        sourceMetadata = {
          ...sourceMetadata,
          type: 'current'
        };
        targetMetadata = {
          ...sourceMetadata,
          type: 'version',
          versionName: version.name,
          versionId: version._id,
          createdAt: version.createdAt
        };
        break;
    }
    
    // Generate comparison data
    const comparison = compareReportSections(sourceSections, targetSections);
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.REPORT,
      entityId: sourceReportId,
      details: { 
        action: 'compare-reports',
        comparisonType,
        sourceReportId,
        targetReportId,
        sourceVersionId,
        targetVersionId
      },
      request: req
    });
    
    return NextResponse.json({
      sourceMetadata,
      targetMetadata,
      comparison
    });
  } catch (error) {
    console.error('Error comparing reports:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Helper function to compare report sections
function compareReportSections(sourceSections: any[], targetSections: any[]) {
  // Create maps for easier lookup
  const sourceSectionMap = new Map();
  sourceSections.forEach(section => {
    sourceSectionMap.set(section.sectionId, section);
  });
  
  const targetSectionMap = new Map();
  targetSections.forEach(section => {
    targetSectionMap.set(section.sectionId, section);
  });
  
  // Get all unique section IDs
  const allSectionIds = new Set([
    ...sourceSections.map(s => s.sectionId),
    ...targetSections.map(s => s.sectionId)
  ]);
  
  // Compare each section
  const sectionComparisons = [];
  
  for (const sectionId of allSectionIds) {
    const sourceSection = sourceSectionMap.get(sectionId);
    const targetSection = targetSectionMap.get(sectionId);
    
    let comparisonResult = {
      sectionId,
      title: (sourceSection?.title || targetSection?.title || ''),
      status: 'unchanged',
      differences: []
    };
    
    // Section exists in both reports
    if (sourceSection && targetSection) {
      // Compare section properties
      if (sourceSection.title !== targetSection.title) {
        comparisonResult.status = 'modified';
        comparisonResult.differences.push({
          field: 'title',
          source: sourceSection.title,
          target: targetSection.title
        });
      }
      
      if (sourceSection.order !== targetSection.order) {
        comparisonResult.status = 'modified';
        comparisonResult.differences.push({
          field: 'order',
          source: sourceSection.order,
          target: targetSection.order
        });
      }
      
      // Compare content based on type
      const sourceContent = sourceSection.content || {};
      const targetContent = targetSection.content || {};
      
      if (sourceContent.type !== targetContent.type) {
        comparisonResult.status = 'modified';
        comparisonResult.differences.push({
          field: 'content.type',
          source: sourceContent.type,
          target: targetContent.type
        });
      }
      
      // Compare text content
      if (sourceContent.text !== targetContent.text) {
        comparisonResult.status = 'modified';
        comparisonResult.differences.push({
          field: 'content.text',
          source: sourceContent.text,
          target: targetContent.text
        });
      }
      
      // Compare chart data if present
      if (sourceContent.chartData && targetContent.chartData) {
        const sourceChartData = sourceContent.chartData;
        const targetChartData = targetContent.chartData;
        
        if (sourceChartData.type !== targetChartData.type) {
          comparisonResult.status = 'modified';
          comparisonResult.differences.push({
            field: 'content.chartData.type',
            source: sourceChartData.type,
            target: targetChartData.type
          });
        }
        
        // Compare labels (simplified comparison)
        if (JSON.stringify(sourceChartData.labels) !== JSON.stringify(targetChartData.labels)) {
          comparisonResult.status = 'modified';
          comparisonResult.differences.push({
            field: 'content.chartData.labels',
            source: sourceChartData.labels,
            target: targetChartData.labels
          });
        }
        
        // Compare datasets (simplified comparison)
        if (JSON.stringify(sourceChartData.datasets) !== JSON.stringify(targetChartData.datasets)) {
          comparisonResult.status = 'modified';
          comparisonResult.differences.push({
            field: 'content.chartData.datasets',
            source: sourceChartData.datasets,
            target: targetChartData.datasets
          });
        }
      } else if (sourceContent.chartData || targetContent.chartData) {
        comparisonResult.status = 'modified';
        comparisonResult.differences.push({
          field: 'content.chartData',
          source: sourceContent.chartData ? 'present' : 'absent',
          target: targetContent.chartData ? 'present' : 'absent'
        });
      }
      
      // Compare table data if present
      if (sourceContent.tableData && targetContent.tableData) {
        const sourceTableData = sourceContent.tableData;
        const targetTableData = targetContent.tableData;
        
        // Compare headers
        if (JSON.stringify(sourceTableData.headers) !== JSON.stringify(targetTableData.headers)) {
          comparisonResult.status = 'modified';
          comparisonResult.differences.push({
            field: 'content.tableData.headers',
            source: sourceTableData.headers,
            target: targetTableData.headers
          });
        }
        
        // Compare rows (simplified comparison)
        if (JSON.stringify(sourceTableData.rows) !== JSON.stringify(targetTableData.rows)) {
          comparisonResult.status = 'modified';
          comparisonResult.differences.push({
            field: 'content.tableData.rows',
            source: sourceTableData.rows,
            target: targetTableData.rows
          });
        }
      } else if (sourceContent.tableData || targetContent.tableData) {
        comparisonResult.status = 'modified';
        comparisonResult.differences.push({
          field: 'content.tableData',
          source: sourceContent.tableData ? 'present' : 'absent',
          target: targetContent.tableData ? 'present' : 'absent'
        });
      }
    } 
    // Section exists only in source
    else if (sourceSection) {
      comparisonResult.status = 'removed';
      comparisonResult.source = sourceSection;
    } 
    // Section exists only in target
    else if (targetSection) {
      comparisonResult.status = 'added';
      comparisonResult.target = targetSection;
    }
    
    sectionComparisons.push(comparisonResult);
  }
  
  // Sort comparisons by section order (if available) or by sectionId
  sectionComparisons.sort((a, b) => {
    const sourceA = sourceSectionMap.get(a.sectionId);
    const sourceB = sourceSectionMap.get(b.sectionId);
    
    if (sourceA && sourceB) {
      return (sourceA.order || 0) - (sourceB.order || 0);
    }
    
    const targetA = targetSectionMap.get(a.sectionId);
    const targetB = targetSectionMap.get(b.sectionId);
    
    if (targetA && targetB) {
      return (targetA.order || 0) - (targetB.order || 0);
    }
    
    if (sourceA) {
      return (sourceA.order || 0) - ((targetB?.order || 0));
    }
    
    if (sourceB) {
      return ((targetA?.order || 0)) - (sourceB.order || 0);
    }
    
    return a.sectionId.localeCompare(b.sectionId);
  });
  
  // Generate summary statistics
  const summary = {
    totalSections: allSectionIds.size,
    unchanged: sectionComparisons.filter(c => c.status === 'unchanged').length,
    modified: sectionComparisons.filter(c => c.status === 'modified').length,
    added: sectionComparisons.filter(c => c.status === 'added').length,
    removed: sectionComparisons.filter(c => c.status === 'removed').length
  };
  
  return {
    summary,
    sections: sectionComparisons
  };
}
