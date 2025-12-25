import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import Assessment from '@/models/Assessment';
import Company from '@/models/Company';
import Warehouse from '@/models/Warehouse';
import Template from '@/models/Template';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';

// Create a new report
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/create');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { 
      title, 
      description, 
      companyId, 
      warehouseId, 
      assessmentId, 
      templateId, 
      tags = [] 
    } = body;
    
    // Validate required fields
    if (!title) {
      return sendError(req, 'Report title is required', 400);
    }
    
    if (!companyId) {
      return sendError(req, 'Company ID is required', 400);
    }
    
    if (!warehouseId) {
      return sendError(req, 'Warehouse ID is required', 400);
    }
    
    if (!assessmentId) {
      return sendError(req, 'Assessment ID is required', 400);
    }
    
    if (!templateId) {
      return sendError(req, 'Template ID is required', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Verify that the company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return sendError(req, 'Company not found', 404);
    }
    
    // Verify that the warehouse exists and belongs to the company
    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      company: companyId
    });
    
    if (!warehouse) {
      return sendError(req, 'Warehouse not found or does not belong to the specified company', 404);
    }
    
    // Verify that the assessment exists
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return sendError(req, 'Assessment not found', 404);
    }
    
    // Verify that the template exists
    const template = await Template.findById(templateId);
    if (!template) {
      return sendError(req, 'Template not found', 404);
    }
    
    // Check if user has permission to create a report for this assessment
    const isAdmin = user.role === 'admin';
    const isCreator = assessment.createdBy?.toString() === user.userId;
    const isAssigned = assessment.assignedUsers?.some(
      (assignedUser: mongoose.Types.ObjectId) => assignedUser.toString() === user.userId
    );
    
    if (!isAdmin && !isCreator && !isAssigned) {
      return sendError(req, 'You do not have permission to create a report for this assessment', 403);
    }
    
    // Create the report
    const report = new Report({
      title,
      description,
      company: companyId,
      warehouse: warehouseId,
      assessment: assessmentId,
      template: templateId,
      tags,
      status: 'draft',
      generatedBy: user.userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Save the report
    const savedReport = await report.save();
    
    // Update the assessment to link to this report
    assessment.reports = assessment.reports || [];
    assessment.reports.push(savedReport._id);
    await assessment.save();
    
    // Return the created report
    return sendSuccess(
      req,
      formatDocument(savedReport.toObject()),
      'Report created successfully',
      201
    );
  } catch (error) {
    logApiError('api/reports/create', error);
    return sendError(
      req, 
      `Error creating report: ${(error as Error).message}`, 
      500
    );
  }
});
