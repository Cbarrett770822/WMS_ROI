import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Get metrics for a specific report or calculate metrics across multiple reports
 */
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const url = new URL(req.url);
    const reportId = url.searchParams.get('reportId');
    const companyId = url.searchParams.get('companyId');
    const warehouseId = url.searchParams.get('warehouseId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const metricType = url.searchParams.get('type') || 'all';
    
    logApiRequest(req, 'api/reports/metrics');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // If reportId is provided, get metrics for a specific report
    if (reportId && mongoose.Types.ObjectId.isValid(reportId)) {
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
      
      // Calculate metrics for the specific report
      const metrics = calculateReportMetrics(report, metricType);
      
      // Log the audit event
      await createAuditLog({
        userId: user.userId,
        action: AuditActions.READ,
        entityType: EntityTypes.REPORT_METRICS,
        entityId: reportId,
        details: { reportId, metricType },
        request: req
      });
      
      return sendSuccess(
        req, 
        formatDocument(metrics), 
        'Report metrics retrieved successfully'
      );
    } 
    // Otherwise, calculate aggregate metrics across multiple reports
    else {
      // Build query filters
      const filters: any = {};
      
      // Filter by company if provided
      if (companyId && mongoose.Types.ObjectId.isValid(companyId)) {
        filters.company = new mongoose.Types.ObjectId(companyId);
      }
      
      // Filter by warehouse if provided
      if (warehouseId && mongoose.Types.ObjectId.isValid(warehouseId)) {
        filters.warehouse = new mongoose.Types.ObjectId(warehouseId);
      }
      
      // Filter by date range if provided
      if (startDate || endDate) {
        filters.generatedAt = {};
        
        if (startDate) {
          filters.generatedAt.$gte = new Date(startDate);
        }
        
        if (endDate) {
          filters.generatedAt.$lte = new Date(endDate);
        }
      }
      
      // For non-admin users, only show reports they have access to
      if (user.role !== 'admin') {
        filters.$or = [
          { generatedBy: new mongoose.Types.ObjectId(user.userId) },
          { sharedWith: new mongoose.Types.ObjectId(user.userId) },
          { isPublic: true }
        ];
      }
      
      // Calculate aggregate metrics
      const aggregateMetrics = await calculateAggregateMetrics(filters, metricType);
      
      // Log the audit event
      await createAuditLog({
        userId: user.userId,
        action: AuditActions.READ,
        entityType: EntityTypes.AGGREGATE_METRICS,
        entityId: 'aggregate',
        details: { filters, metricType },
        request: req
      });
      
      return sendSuccess(
        req, 
        formatDocument(aggregateMetrics), 
        'Aggregate metrics retrieved successfully'
      );
    }
  } catch (error) {
    logApiError('api/reports/metrics', error);
    return sendError(
      req, 
      `Error retrieving metrics: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Calculate metrics for a specific report
 */
function calculateReportMetrics(report: any, metricType: string) {
  // Base metrics object
  const metrics: any = {
    reportId: report._id,
    title: report.title,
    generatedAt: report.generatedAt,
    lastModified: report.lastModified
  };
  
  // Calculate ROI metrics
  if (metricType === 'roi' || metricType === 'all') {
    metrics.roi = calculateRoiMetrics(report);
  }
  
  // Calculate operational metrics
  if (metricType === 'operational' || metricType === 'all') {
    metrics.operational = calculateOperationalMetrics(report);
  }
  
  // Calculate financial metrics
  if (metricType === 'financial' || metricType === 'all') {
    metrics.financial = calculateFinancialMetrics(report);
  }
  
  // Calculate engagement metrics
  if (metricType === 'engagement' || metricType === 'all') {
    metrics.engagement = {
      viewCount: report.viewCount || 0,
      downloadCount: report.downloadCount || 0,
      commentCount: report.comments?.length || 0,
      shareCount: report.sharedWith?.length || 0,
      versionCount: report.versions?.length || 0,
      lastViewed: report.lastViewed || null
    };
  }
  
  return metrics;
}

/**
 * Calculate ROI metrics from report data
 */
function calculateRoiMetrics(report: any) {
  // Extract ROI data from report sections
  let totalInvestment = 0;
  let totalReturn = 0;
  let paybackPeriod = 0;
  let roiPercentage = 0;
  let npv = 0;
  let irr = 0;
  
  // Find ROI section in report
  const roiSection = report.sections?.find((section: any) => 
    section.type === 'roi' || section.title?.toLowerCase().includes('roi')
  );
  
  if (roiSection) {
    // Extract metrics from ROI section
    totalInvestment = roiSection.data?.totalInvestment || 0;
    totalReturn = roiSection.data?.totalReturn || 0;
    paybackPeriod = roiSection.data?.paybackPeriod || 0;
    roiPercentage = roiSection.data?.roiPercentage || 0;
    npv = roiSection.data?.npv || 0;
    irr = roiSection.data?.irr || 0;
  }
  
  return {
    totalInvestment,
    totalReturn,
    paybackPeriod,
    roiPercentage,
    npv,
    irr,
    // Calculate additional metrics
    netReturn: totalReturn - totalInvestment,
    returnRatio: totalInvestment > 0 ? totalReturn / totalInvestment : 0
  };
}

/**
 * Calculate operational metrics from report data
 */
function calculateOperationalMetrics(report: any) {
  // Find operational sections in report
  const operationalSection = report.sections?.find((section: any) => 
    section.type === 'operational' || section.title?.toLowerCase().includes('operational')
  );
  
  // Default metrics
  const metrics = {
    laborEfficiency: 0,
    spaceUtilization: 0,
    inventoryTurnover: 0,
    pickingAccuracy: 0,
    throughputRate: 0,
    errorRate: 0
  };
  
  if (operationalSection) {
    // Extract metrics from operational section
    Object.keys(metrics).forEach(key => {
      if (operationalSection.data && operationalSection.data[key] !== undefined) {
        metrics[key as keyof typeof metrics] = operationalSection.data[key];
      }
    });
  }
  
  return metrics;
}

/**
 * Calculate financial metrics from report data
 */
function calculateFinancialMetrics(report: any) {
  // Find financial sections in report
  const financialSection = report.sections?.find((section: any) => 
    section.type === 'financial' || section.title?.toLowerCase().includes('financial')
  );
  
  // Default metrics
  const metrics = {
    implementationCost: 0,
    annualSavings: 0,
    operationalCostReduction: 0,
    laborCostSavings: 0,
    inventoryCostReduction: 0,
    maintenanceCost: 0
  };
  
  if (financialSection) {
    // Extract metrics from financial section
    Object.keys(metrics).forEach(key => {
      if (financialSection.data && financialSection.data[key] !== undefined) {
        metrics[key as keyof typeof metrics] = financialSection.data[key];
      }
    });
  }
  
  return metrics;
}

/**
 * Calculate aggregate metrics across multiple reports
 */
async function calculateAggregateMetrics(filters: any, metricType: string) {
  // Get all matching reports
  const reports = await Report.find(filters).lean();
  
  // Base metrics object
  const metrics: any = {
    reportCount: reports.length,
    dateRange: {
      start: filters.generatedAt?.$gte || null,
      end: filters.generatedAt?.$lte || null
    }
  };
  
  // Calculate aggregate ROI metrics
  if (metricType === 'roi' || metricType === 'all') {
    const roiMetrics = reports.map(report => calculateRoiMetrics(report));
    
    metrics.roi = {
      averageTotalInvestment: calculateAverage(roiMetrics.map(m => m.totalInvestment)),
      averageTotalReturn: calculateAverage(roiMetrics.map(m => m.totalReturn)),
      averagePaybackPeriod: calculateAverage(roiMetrics.map(m => m.paybackPeriod)),
      averageRoiPercentage: calculateAverage(roiMetrics.map(m => m.roiPercentage)),
      totalInvestment: roiMetrics.reduce((sum, m) => sum + m.totalInvestment, 0),
      totalReturn: roiMetrics.reduce((sum, m) => sum + m.totalReturn, 0)
    };
  }
  
  // Calculate aggregate operational metrics
  if (metricType === 'operational' || metricType === 'all') {
    const operationalMetrics = reports.map(report => calculateOperationalMetrics(report));
    
    metrics.operational = {
      averageLaborEfficiency: calculateAverage(operationalMetrics.map(m => m.laborEfficiency)),
      averageSpaceUtilization: calculateAverage(operationalMetrics.map(m => m.spaceUtilization)),
      averageInventoryTurnover: calculateAverage(operationalMetrics.map(m => m.inventoryTurnover)),
      averagePickingAccuracy: calculateAverage(operationalMetrics.map(m => m.pickingAccuracy)),
      averageThroughputRate: calculateAverage(operationalMetrics.map(m => m.throughputRate)),
      averageErrorRate: calculateAverage(operationalMetrics.map(m => m.errorRate))
    };
  }
  
  // Calculate aggregate financial metrics
  if (metricType === 'financial' || metricType === 'all') {
    const financialMetrics = reports.map(report => calculateFinancialMetrics(report));
    
    metrics.financial = {
      totalImplementationCost: financialMetrics.reduce((sum, m) => sum + m.implementationCost, 0),
      totalAnnualSavings: financialMetrics.reduce((sum, m) => sum + m.annualSavings, 0),
      totalOperationalCostReduction: financialMetrics.reduce((sum, m) => sum + m.operationalCostReduction, 0),
      totalLaborCostSavings: financialMetrics.reduce((sum, m) => sum + m.laborCostSavings, 0),
      totalInventoryCostReduction: financialMetrics.reduce((sum, m) => sum + m.inventoryCostReduction, 0),
      averageImplementationCost: calculateAverage(financialMetrics.map(m => m.implementationCost)),
      averageAnnualSavings: calculateAverage(financialMetrics.map(m => m.annualSavings))
    };
  }
  
  // Calculate aggregate engagement metrics
  if (metricType === 'engagement' || metricType === 'all') {
    metrics.engagement = {
      totalViews: reports.reduce((sum, report) => sum + (report.viewCount || 0), 0),
      totalDownloads: reports.reduce((sum, report) => sum + (report.downloadCount || 0), 0),
      totalComments: reports.reduce((sum, report) => sum + (report.comments?.length || 0), 0),
      totalShares: reports.reduce((sum, report) => sum + (report.sharedWith?.length || 0), 0),
      averageViews: calculateAverage(reports.map(report => report.viewCount || 0)),
      averageDownloads: calculateAverage(reports.map(report => report.downloadCount || 0)),
      averageComments: calculateAverage(reports.map(report => report.comments?.length || 0)),
      averageShares: calculateAverage(reports.map(report => report.sharedWith?.length || 0))
    };
  }
  
  return metrics;
}

/**
 * Helper function to calculate average of an array of numbers
 */
function calculateAverage(values: number[]): number {
  if (!values || values.length === 0) return 0;
  const sum = values.reduce((total, val) => total + (val || 0), 0);
  return sum / values.length;
}
