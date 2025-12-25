import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Company from '@/models/Company';
import Warehouse from '@/models/Warehouse';
import Assessment from '@/models/Assessment';
import QuestionnaireResponse from '@/models/QuestionnaireResponse';
import ROICalculation from '@/models/ROICalculation';
import Recommendation from '@/models/Recommendation';
import Report from '@/models/Report';
import Benchmark from '@/models/Benchmark';
import { withAuthAppRouter, withAdminAuthAppRouter } from '@/lib/auth';

// Export data (admin only)
export const POST = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const { entities, companyId } = await req.json();

    if (!entities || !Array.isArray(entities) || entities.length === 0) {
      return NextResponse.json(
        { message: 'At least one entity type must be specified for export' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    const exportData: any = {};
    const validEntities = [
      'companies', 
      'warehouses', 
      'assessments', 
      'questionnaireResponses', 
      'roiCalculations', 
      'recommendations', 
      'reports', 
      'benchmarks'
    ];

    // Validate entity types
    for (const entity of entities) {
      if (!validEntities.includes(entity)) {
        return NextResponse.json(
          { message: `Invalid entity type: ${entity}` },
          { status: 400 }
        );
      }
    }

    // Build queries based on companyId filter
    const queries: any = {};
    if (companyId) {
      queries.companies = { _id: companyId };
      queries.warehouses = { company: companyId };
      queries.assessments = { company: companyId };
      
      // Get assessment IDs for this company to filter related entities
      const assessments = await Assessment.find({ company: companyId }).select('_id');
      const assessmentIds = assessments.map(a => a._id);
      
      if (assessmentIds.length > 0) {
        queries.questionnaireResponses = { assessment: { $in: assessmentIds } };
        queries.roiCalculations = { assessment: { $in: assessmentIds } };
        queries.recommendations = { assessment: { $in: assessmentIds } };
        queries.reports = { assessment: { $in: assessmentIds } };
      } else {
        // No assessments found, use empty arrays for related entities
        queries.questionnaireResponses = { _id: { $in: [] } };
        queries.roiCalculations = { _id: { $in: [] } };
        queries.recommendations = { _id: { $in: [] } };
        queries.reports = { _id: { $in: [] } };
      }
      
      // Benchmarks are not filtered by company
      queries.benchmarks = {};
    } else {
      // No filters
      validEntities.forEach(entity => {
        queries[entity] = {};
      });
    }

    // Fetch data for each requested entity type
    for (const entity of entities) {
      switch (entity) {
        case 'companies':
          exportData.companies = await Company.find(queries.companies);
          break;
        case 'warehouses':
          exportData.warehouses = await Warehouse.find(queries.warehouses);
          break;
        case 'assessments':
          exportData.assessments = await Assessment.find(queries.assessments);
          break;
        case 'questionnaireResponses':
          exportData.questionnaireResponses = await QuestionnaireResponse.find(queries.questionnaireResponses);
          break;
        case 'roiCalculations':
          exportData.roiCalculations = await ROICalculation.find(queries.roiCalculations);
          break;
        case 'recommendations':
          exportData.recommendations = await Recommendation.find(queries.recommendations);
          break;
        case 'reports':
          exportData.reports = await Report.find(queries.reports);
          break;
        case 'benchmarks':
          exportData.benchmarks = await Benchmark.find(queries.benchmarks);
          break;
      }
    }

    // Add metadata
    exportData.metadata = {
      exportedAt: new Date(),
      exportedBy: user.userId,
      entityCounts: {}
    };

    // Add counts for each entity
    for (const entity of entities) {
      exportData.metadata.entityCounts[entity] = exportData[entity].length;
    }

    return NextResponse.json({
      message: 'Data exported successfully',
      data: exportData
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json(
      { message: 'Internal server error', error: (error as Error).message },
      { status: 500 }
    );
  }
});
