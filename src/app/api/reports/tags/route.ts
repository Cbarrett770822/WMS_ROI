import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, logApiRequest, logApiError } from '@/lib/apiResponse';

/**
 * Get all unique tags used in reports
 */
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/tags');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Build query based on user role
    const isAdmin = user.role === 'admin';
    const query = isAdmin ? {} : { 
      $or: [
        { generatedBy: user.userId },
        { sharedWith: user.userId }
      ]
    };
    
    // Aggregate to get all unique tags
    const tagsAggregation = await Report.aggregate([
      { $match: query },
      { $unwind: "$tags" },
      { $group: { _id: "$tags" } },
      { $sort: { _id: 1 } }
    ]);
    
    // Extract tags from aggregation result
    const tags = tagsAggregation.map(item => item._id);
    
    return sendSuccess(req, tags, 'Tags retrieved successfully');
  } catch (error) {
    logApiError('api/reports/tags', error);
    return sendError(
      req, 
      `Error retrieving tags: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Add new tags to the system
 */
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/tags');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Only admins can add new tags
    if (user.role !== 'admin') {
      return sendError(req, 'Only administrators can add new tags', 403);
    }
    
    // Parse request body
    const { tags } = await req.json();
    
    if (!Array.isArray(tags) || tags.length === 0) {
      return sendError(req, 'Tags must be a non-empty array', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Get existing tags
    const tagsAggregation = await Report.aggregate([
      { $unwind: "$tags" },
      { $group: { _id: "$tags" } }
    ]);
    
    const existingTags = new Set(tagsAggregation.map(item => item._id));
    
    // Filter out tags that already exist
    const newTags = tags.filter(tag => !existingTags.has(tag));
    
    if (newTags.length === 0) {
      return sendSuccess(req, [], 'All tags already exist');
    }
    
    // Create a dummy report with the new tags to make them available
    // This is a workaround since we don't have a separate Tags collection
    const dummyReport = new Report({
      title: 'Tag Repository',
      description: 'This report exists only to store system tags',
      tags: newTags,
      status: 'system',
      generatedBy: user.userId,
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await dummyReport.save();
    
    return sendSuccess(
      req, 
      newTags, 
      'Tags added successfully', 
      201
    );
  } catch (error) {
    logApiError('api/reports/tags', error);
    return sendError(
      req, 
      `Error adding tags: ${(error as Error).message}`, 
      500
    );
  }
});
