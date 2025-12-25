import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import mongoose from 'mongoose';

// Get analytics data for reports
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId');
    const warehouseId = url.searchParams.get('warehouseId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const type = url.searchParams.get('type');
    
    // Connect to the database
    await connectToDatabase();
    
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
        { sharedWith: new mongoose.Types.ObjectId(user.userId) }
      ];
    }
    
    // Determine which analytics to return based on type
    let analyticsData: any = {};
    
    switch (type) {
      case 'overview':
        // Get overview analytics (default)
        analyticsData = await getOverviewAnalytics(filters, user);
        break;
        
      case 'usage':
        // Get usage analytics
        analyticsData = await getUsageAnalytics(filters, user);
        break;
        
      case 'sharing':
        // Get sharing analytics
        analyticsData = await getSharingAnalytics(filters, user);
        break;
        
      case 'templates':
        // Get template usage analytics
        analyticsData = await getTemplateAnalytics(filters, user);
        break;
        
      default:
        // Default to overview analytics
        analyticsData = await getOverviewAnalytics(filters, user);
    }
    
    return NextResponse.json(analyticsData);
  } catch (error) {
    console.error('Error getting report analytics:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Helper function to get overview analytics
async function getOverviewAnalytics(filters: any, user: any) {
  // Get total counts
  const totalReports = await Report.countDocuments(filters);
  
  // Get status breakdown
  const statusAggregation = await Report.aggregate([
    { $match: filters },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  
  const statusCounts = {
    draft: 0,
    published: 0,
    archived: 0
  };
  
  statusAggregation.forEach((item: any) => {
    if (item._id && statusCounts.hasOwnProperty(item._id)) {
      statusCounts[item._id as keyof typeof statusCounts] = item.count;
    }
  });
  
  // Get reports created over time (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const timeSeriesFilters = { ...filters, generatedAt: { $gte: sixMonthsAgo } };
  
  const timeSeriesAggregation = await Report.aggregate([
    { $match: timeSeriesFilters },
    {
      $group: {
        _id: {
          year: { $year: '$generatedAt' },
          month: { $month: '$generatedAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);
  
  // Format time series data
  const timeSeriesData = timeSeriesAggregation.map((item: any) => ({
    period: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
    count: item.count
  }));
  
  // Get top 5 most downloaded reports
  const topDownloadedReports = await Report.find(filters)
    .sort({ downloadCount: -1 })
    .limit(5)
    .select('name downloadCount lastDownloaded');
  
  // Get top 5 most shared reports
  const topSharedReports = await Report.aggregate([
    { $match: filters },
    { $addFields: { sharedWithCount: { $size: { $ifNull: ['$sharedWith', []] } } } },
    { $sort: { sharedWithCount: -1 } },
    { $limit: 5 },
    { $project: { name: 1, sharedWithCount: 1 } }
  ]);
  
  return {
    totalReports,
    statusCounts,
    timeSeriesData,
    topDownloadedReports,
    topSharedReports
  };
}

// Helper function to get usage analytics
async function getUsageAnalytics(filters: any, user: any) {
  // Get download statistics
  const downloadStats = await Report.aggregate([
    { $match: filters },
    {
      $group: {
        _id: null,
        totalDownloads: { $sum: '$downloadCount' },
        averageDownloads: { $avg: '$downloadCount' },
        maxDownloads: { $max: '$downloadCount' },
        reportsWithDownloads: {
          $sum: { $cond: [{ $gt: ['$downloadCount', 0] }, 1, 0] }
        }
      }
    }
  ]);
  
  // Get download trends over time (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  // This would require download history which isn't in our current model
  // For now, we'll use the last downloaded date as a proxy
  const downloadTrends = await Report.aggregate([
    { 
      $match: { 
        ...filters,
        lastDownloaded: { $gte: sixMonthsAgo }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$lastDownloaded' },
          month: { $month: '$lastDownloaded' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);
  
  // Format download trends data
  const downloadTrendsData = downloadTrends.map((item: any) => ({
    period: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
    count: item.count
  }));
  
  // Get reports by status
  const reportsByStatus = await Report.aggregate([
    { $match: filters },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  
  // Format reports by status
  const reportsByStatusData = reportsByStatus.map((item: any) => ({
    status: item._id,
    count: item.count
  }));
  
  return {
    downloadStats: downloadStats[0] || {
      totalDownloads: 0,
      averageDownloads: 0,
      maxDownloads: 0,
      reportsWithDownloads: 0
    },
    downloadTrends: downloadTrendsData,
    reportsByStatus: reportsByStatusData
  };
}

// Helper function to get sharing analytics
async function getSharingAnalytics(filters: any, user: any) {
  // Get sharing statistics
  const sharingStats = await Report.aggregate([
    { $match: filters },
    {
      $addFields: {
        sharedWithCount: { $size: { $ifNull: ['$sharedWith', []] } }
      }
    },
    {
      $group: {
        _id: null,
        totalShares: { $sum: '$sharedWithCount' },
        averageShares: { $avg: '$sharedWithCount' },
        maxShares: { $max: '$sharedWithCount' },
        reportsShared: {
          $sum: { $cond: [{ $gt: ['$sharedWithCount', 0] }, 1, 0] }
        }
      }
    }
  ]);
  
  // Get most shared reports
  const mostSharedReports = await Report.aggregate([
    { $match: filters },
    { $addFields: { sharedWithCount: { $size: { $ifNull: ['$sharedWith', []] } } } },
    { $match: { sharedWithCount: { $gt: 0 } } },
    { $sort: { sharedWithCount: -1 } },
    { $limit: 10 },
    { $project: { name: 1, sharedWithCount: 1, generatedAt: 1 } }
  ]);
  
  // Get reports by sharing count
  const reportsBySharingCount = await Report.aggregate([
    { $match: filters },
    {
      $addFields: {
        sharedWithCount: { $size: { $ifNull: ['$sharedWith', []] } }
      }
    },
    {
      $group: {
        _id: '$sharedWithCount',
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  // Format reports by sharing count
  const reportsBySharingCountData = reportsBySharingCount.map((item: any) => ({
    sharingCount: item._id,
    reportCount: item.count
  }));
  
  return {
    sharingStats: sharingStats[0] || {
      totalShares: 0,
      averageShares: 0,
      maxShares: 0,
      reportsShared: 0
    },
    mostSharedReports,
    reportsBySharingCount: reportsBySharingCountData
  };
}

// Helper function to get template analytics
async function getTemplateAnalytics(filters: any, user: any) {
  // Get reports by template
  const reportsByTemplate = await Report.aggregate([
    { $match: filters },
    {
      $lookup: {
        from: 'reporttemplates',
        localField: 'template',
        foreignField: '_id',
        as: 'templateInfo'
      }
    },
    { $unwind: { path: '$templateInfo', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$template',
        templateName: { $first: '$templateInfo.name' },
        templateType: { $first: '$templateInfo.type' },
        count: { $sum: 1 },
        downloads: { $sum: '$downloadCount' }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  // Get reports by template type
  const reportsByTemplateType = await Report.aggregate([
    { $match: filters },
    {
      $lookup: {
        from: 'reporttemplates',
        localField: 'template',
        foreignField: '_id',
        as: 'templateInfo'
      }
    },
    { $unwind: { path: '$templateInfo', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$templateInfo.type',
        count: { $sum: 1 },
        downloads: { $sum: '$downloadCount' }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  // Format reports by template type
  const reportsByTemplateTypeData = reportsByTemplateType.map((item: any) => ({
    templateType: item._id || 'unknown',
    reportCount: item.count,
    downloadCount: item.downloads
  }));
  
  return {
    reportsByTemplate,
    reportsByTemplateType: reportsByTemplateTypeData
  };
}
