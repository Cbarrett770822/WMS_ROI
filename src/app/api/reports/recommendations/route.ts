import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Generate or retrieve recommendations for a report
 */
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/recommendations');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { reportId, forceRegenerate = false } = body;
    
    // Validate required fields
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId);
    
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
    
    // Check if recommendations already exist and are not being forced to regenerate
    if (!forceRegenerate && report.recommendations && report.recommendations.length > 0) {
      return sendSuccess(
        req,
        formatDocument(report.recommendations),
        'Existing recommendations retrieved successfully'
      );
    }
    
    // Generate new recommendations based on report data
    const recommendations = await generateRecommendations(report);
    
    // Update the report with the new recommendations
    report.recommendations = recommendations;
    report.lastModified = new Date();
    report.lastModifiedBy = user.userId;
    
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UPDATE,
      entityType: EntityTypes.REPORT,
      entityId: reportId,
      details: { 
        reportId, 
        action: 'generate_recommendations',
        recommendationCount: recommendations.length
      },
      request: req
    });
    
    return sendSuccess(
      req,
      formatDocument(recommendations),
      'Recommendations generated successfully'
    );
  } catch (error) {
    logApiError('api/reports/recommendations', error);
    return sendError(
      req, 
      `Error generating recommendations: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Get recommendations for a report
 */
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const url = new URL(req.url);
    const reportId = url.searchParams.get('reportId');
    
    logApiRequest(req, 'api/reports/recommendations');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
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
    
    // Check if recommendations exist
    if (!report.recommendations || report.recommendations.length === 0) {
      return sendSuccess(
        req,
        [],
        'No recommendations found for this report'
      );
    }
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.REPORT_RECOMMENDATIONS,
      entityId: reportId,
      details: { reportId },
      request: req
    });
    
    return sendSuccess(
      req,
      formatDocument(report.recommendations),
      'Recommendations retrieved successfully'
    );
  } catch (error) {
    logApiError('api/reports/recommendations', error);
    return sendError(
      req, 
      `Error retrieving recommendations: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Generate recommendations based on report data
 * This is a placeholder implementation that would be replaced with actual AI-based recommendation logic
 */
async function generateRecommendations(report: any) {
  // Extract data from report sections
  const sections = report.sections || [];
  
  // Initialize recommendations array
  const recommendations: any[] = [];
  
  // Find ROI section
  const roiSection = sections.find((section: any) => 
    section.type === 'roi' || section.title?.toLowerCase().includes('roi')
  );
  
  // Find operational section
  const operationalSection = sections.find((section: any) => 
    section.type === 'operational' || section.title?.toLowerCase().includes('operational')
  );
  
  // Find financial section
  const financialSection = sections.find((section: any) => 
    section.type === 'financial' || section.title?.toLowerCase().includes('financial')
  );
  
  // Generate ROI-based recommendations
  if (roiSection) {
    const roiData = roiSection.data || {};
    
    // Example: If payback period is too long
    if (roiData.paybackPeriod && roiData.paybackPeriod > 24) {
      recommendations.push({
        id: new mongoose.Types.ObjectId(),
        category: 'ROI',
        priority: 'high',
        title: 'Reduce Payback Period',
        description: 'The current payback period exceeds 2 years. Consider phasing implementation to achieve earlier returns or negotiating better terms with vendors.',
        impact: 'Improved cash flow and reduced financial risk',
        actionItems: [
          'Identify components that can be implemented in phases',
          'Negotiate extended payment terms with vendors',
          'Focus on high-return components first'
        ],
        metrics: {
          current: roiData.paybackPeriod,
          target: 18,
          unit: 'months'
        },
        createdAt: new Date()
      });
    }
    
    // Example: If ROI percentage is low
    if (roiData.roiPercentage && roiData.roiPercentage < 15) {
      recommendations.push({
        id: new mongoose.Types.ObjectId(),
        category: 'ROI',
        priority: 'medium',
        title: 'Improve ROI Percentage',
        description: 'The current ROI percentage is below industry average. Identify additional value opportunities or cost reduction strategies.',
        impact: 'Increased return on investment and project viability',
        actionItems: [
          'Review cost assumptions for accuracy',
          'Identify additional benefit streams not currently captured',
          'Consider alternative implementation approaches'
        ],
        metrics: {
          current: roiData.roiPercentage,
          target: 20,
          unit: 'percent'
        },
        createdAt: new Date()
      });
    }
  }
  
  // Generate operational recommendations
  if (operationalSection) {
    const opData = operationalSection.data || {};
    
    // Example: If labor efficiency is low
    if (opData.laborEfficiency && opData.laborEfficiency < 70) {
      recommendations.push({
        id: new mongoose.Types.ObjectId(),
        category: 'Operational',
        priority: 'high',
        title: 'Improve Labor Efficiency',
        description: 'Current labor efficiency is below target. Implement training programs and process improvements to increase productivity.',
        impact: 'Reduced labor costs and improved throughput',
        actionItems: [
          'Conduct time-motion studies to identify bottlenecks',
          'Implement standardized work procedures',
          'Provide targeted training for underperforming areas',
          'Consider incentive programs tied to productivity metrics'
        ],
        metrics: {
          current: opData.laborEfficiency,
          target: 85,
          unit: 'percent'
        },
        createdAt: new Date()
      });
    }
    
    // Example: If space utilization is low
    if (opData.spaceUtilization && opData.spaceUtilization < 75) {
      recommendations.push({
        id: new mongoose.Types.ObjectId(),
        category: 'Operational',
        priority: 'medium',
        title: 'Optimize Space Utilization',
        description: 'Warehouse space is not being utilized efficiently. Reorganize storage layout and implement better slotting strategies.',
        impact: 'Increased storage capacity and reduced facility costs',
        actionItems: [
          'Conduct ABC analysis for inventory placement',
          'Implement dynamic slotting based on velocity',
          'Consider high-density storage solutions for slow-moving items',
          'Review aisle widths and adjust for equipment requirements'
        ],
        metrics: {
          current: opData.spaceUtilization,
          target: 90,
          unit: 'percent'
        },
        createdAt: new Date()
      });
    }
    
    // Example: If picking accuracy is low
    if (opData.pickingAccuracy && opData.pickingAccuracy < 98) {
      recommendations.push({
        id: new mongoose.Types.ObjectId(),
        category: 'Operational',
        priority: 'high',
        title: 'Improve Picking Accuracy',
        description: 'Current picking accuracy is below industry standard. Implement verification procedures and technology solutions.',
        impact: 'Reduced error correction costs and improved customer satisfaction',
        actionItems: [
          'Implement barcode scanning for item verification',
          'Add visual indicators for pick locations',
          'Establish quality check stations for high-value items',
          'Provide additional training for new employees'
        ],
        metrics: {
          current: opData.pickingAccuracy,
          target: 99.5,
          unit: 'percent'
        },
        createdAt: new Date()
      });
    }
  }
  
  // Generate financial recommendations
  if (financialSection) {
    const finData = financialSection.data || {};
    
    // Example: If implementation cost is high
    if (finData.implementationCost && finData.implementationCost > 500000) {
      recommendations.push({
        id: new mongoose.Types.ObjectId(),
        category: 'Financial',
        priority: 'medium',
        title: 'Reduce Implementation Costs',
        description: 'Implementation costs are higher than expected. Explore alternative vendors and phased implementation approaches.',
        impact: 'Reduced capital expenditure and improved project ROI',
        actionItems: [
          'Request competitive bids from multiple vendors',
          'Identify components that can be deferred to later phases',
          'Explore leasing options for equipment instead of purchasing',
          'Review scope for potential simplifications'
        ],
        metrics: {
          current: finData.implementationCost,
          target: finData.implementationCost * 0.8,
          unit: 'currency'
        },
        createdAt: new Date()
      });
    }
    
    // Example: If maintenance costs are high
    if (finData.maintenanceCost && finData.maintenanceCost > 50000) {
      recommendations.push({
        id: new mongoose.Types.ObjectId(),
        category: 'Financial',
        priority: 'low',
        title: 'Optimize Maintenance Costs',
        description: 'Annual maintenance costs are higher than industry benchmarks. Negotiate better service contracts and implement preventive maintenance.',
        impact: 'Reduced operational expenses and improved system reliability',
        actionItems: [
          'Negotiate multi-year service contracts for better rates',
          'Train internal staff for first-level maintenance tasks',
          'Implement preventive maintenance program to reduce breakdowns',
          'Consider alternative service providers'
        ],
        metrics: {
          current: finData.maintenanceCost,
          target: finData.maintenanceCost * 0.7,
          unit: 'currency'
        },
        createdAt: new Date()
      });
    }
  }
  
  // Add general recommendations if we don't have enough specific ones
  if (recommendations.length < 3) {
    recommendations.push({
      id: new mongoose.Types.ObjectId(),
      category: 'General',
      priority: 'medium',
      title: 'Establish Performance Baseline',
      description: 'Establish clear baseline metrics before implementation to accurately measure improvements.',
      impact: 'Improved ability to measure ROI and project success',
      actionItems: [
        'Document current operational KPIs in detail',
        'Implement regular data collection procedures',
        'Create dashboard for ongoing performance tracking',
        'Set clear improvement targets for each metric'
      ],
      metrics: null,
      createdAt: new Date()
    });
    
    recommendations.push({
      id: new mongoose.Types.ObjectId(),
      category: 'General',
      priority: 'medium',
      title: 'Develop Change Management Plan',
      description: 'Create a comprehensive change management plan to ensure successful adoption of new processes.',
      impact: 'Improved employee adoption and reduced implementation risk',
      actionItems: [
        'Identify key stakeholders and change champions',
        'Develop communication strategy for all affected staff',
        'Create training program for new processes and systems',
        'Establish feedback mechanism for continuous improvement'
      ],
      metrics: null,
      createdAt: new Date()
    });
  }
  
  return recommendations;
}
