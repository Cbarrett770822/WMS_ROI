import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Assessment from '@/models/Assessment';
import Company from '@/models/Company';
import Warehouse from '@/models/Warehouse';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import mongoose from 'mongoose';

// Get dashboard data
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Connect to the database
    await connectToDatabase();

    // Build query based on user role
    const isAdmin = user.role === 'admin';
    const query = isAdmin ? {} : { $or: [
      { createdBy: user.userId },
      { assignedUsers: user.userId }
    ]};

    // Get company filter if provided
    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId');
    
    if (companyId) {
      if (isAdmin) {
        // Admin can filter by any company
        query.company = companyId;
      } else {
        // Regular users can only filter by companies they have access to
        query.$or = [
          { createdBy: user.userId, company: companyId },
          { assignedUsers: user.userId, company: companyId }
        ];
      }
    }

    // Get assessments
    const assessments = await Assessment.find(query)
      .populate('company', 'name industry')
      .populate('warehouse', 'name type')
      .sort({ createdAt: -1 });

    // Get assessment IDs
    const assessmentIds = assessments.map(a => a._id);

    // Get ROI calculations for these assessments
    const roiCalculations = await ROICalculation.find({
      assessment: { $in: assessmentIds }
    }).select('assessment financialMetrics categoryScores');

    // Get reports for these assessments
    const reports = await Report.find({
      assessment: { $in: assessmentIds }
    }).select('assessment title createdAt downloadCount');

    // Get counts
    const totalAssessments = await Assessment.countDocuments(query);
    
    // Get company count (based on user role)
    let totalCompanies;
    if (isAdmin) {
      totalCompanies = await Company.countDocuments();
    } else {
      // Get unique companies from assessments
      const companyIds = [...new Set(assessments.map(a => a.company?._id?.toString()))];
      totalCompanies = companyIds.length;
    }
    
    // Get warehouse count (based on user role)
    let totalWarehouses;
    if (isAdmin) {
      totalWarehouses = await Warehouse.countDocuments();
    } else {
      // Get unique warehouses from assessments
      const warehouseIds = [...new Set(assessments.map(a => a.warehouse?._id?.toString()))];
      totalWarehouses = warehouseIds.length;
    }
    
    // Get total reports
    const reportQuery = isAdmin ? {} : { 
      $or: [
        { generatedBy: user.userId },
        { sharedWith: user.userId }
      ]
    };
    const totalReports = await Report.countDocuments(reportQuery);

    // Calculate average ROI
    let averageROI = 0;
    let totalInvestment = 0;
    let totalSavings = 0;
    
    if (roiCalculations.length > 0) {
      const totalROI = roiCalculations.reduce((sum, calc) => 
        sum + (calc.financialMetrics?.roi || 0), 0);
      averageROI = totalROI / roiCalculations.length;
      
      // Calculate total investment and savings
      totalInvestment = roiCalculations.reduce((sum, calc) => 
        sum + (calc.financialMetrics?.totalInvestment || 0), 0);
      totalSavings = roiCalculations.reduce((sum, calc) => 
        sum + (calc.financialMetrics?.annualSavings || 0), 0);
    }

    // Get assessment status counts
    const assessmentsByStatus = await Assessment.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } }
    ]);
    
    // Get report status counts
    const reportsByStatus = await Report.aggregate([
      { $match: reportQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } }
    ]);

    // Get recent assessments (last 5)
    const recentAssessments = assessments.slice(0, 5).map(a => ({
      id: a._id,
      name: a.name,
      company: {
        id: a.company?._id || '',
        name: a.company?.name || 'Unknown Company'
      },
      warehouse: a.warehouse ? {
        id: a.warehouse._id || '',
        name: a.warehouse.name || 'Unknown Warehouse'
      } : undefined,
      status: a.status || 'draft',
      completedAt: a.completedAt,
      createdAt: a.createdAt
    }));

    // Get recent reports (last 5)
    const recentReportsQuery = [...reportQuery.$or];
    const recentReportsData = await Report.find({ $or: recentReportsQuery })
      .populate('company', 'name')
      .populate('warehouse', 'name')
      .populate('generatedBy', 'name')
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();
      
    const recentReports = recentReportsData.map(report => ({
      id: report._id,
      title: report.title,
      company: {
        id: report.company?._id || '',
        name: report.company?.name || 'Unknown Company'
      },
      warehouse: report.warehouse ? {
        id: report.warehouse._id || '',
        name: report.warehouse.name || 'Unknown Warehouse'
      } : undefined,
      status: report.status || 'draft',
      createdAt: report.createdAt,
      updatedAt: report.updatedAt
    }));





    // Return dashboard data
    return NextResponse.json({
      totalReports,
      totalAssessments,
      totalCompanies,
      totalWarehouses,
      recentReports,
      recentAssessments,
      reportsByStatus,
      assessmentsByStatus
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
