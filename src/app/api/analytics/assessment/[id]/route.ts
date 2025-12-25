import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Assessment from '@/models/Assessment';
import QuestionnaireResponse from '@/models/QuestionnaireResponse';
import ROICalculation from '@/models/ROICalculation';
import Recommendation from '@/models/Recommendation';
import Benchmark from '@/models/Benchmark';
import { withAuthAppRouter } from '@/lib/auth';
import mongoose from 'mongoose';

// Get assessment-specific analytics data
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const assessmentId = req.url.split('/').pop();
    
    if (!assessmentId || !mongoose.Types.ObjectId.isValid(assessmentId)) {
      return NextResponse.json(
        { message: 'Invalid assessment ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the assessment with populated references
    const assessment = await Assessment.findById(assessmentId)
      .populate('company', 'name industry size')
      .populate('warehouse', 'name type size location')
      .populate('createdBy', 'username firstName lastName')
      .populate('assignedUsers', 'username firstName lastName');
      
    if (!assessment) {
      return NextResponse.json(
        { message: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this assessment
    const isAdmin = user.role === 'admin';
    const isCreator = assessment.createdBy && 
      assessment.createdBy._id.toString() === user.userId;
    const isAssigned = assessment.assignedUsers?.some(
      (assignedUser: any) => assignedUser._id.toString() === user.userId
    );

    if (!isAdmin && !isCreator && !isAssigned) {
      return NextResponse.json(
        { message: 'You do not have permission to access this assessment' },
        { status: 403 }
      );
    }

    // Get questionnaire responses for this assessment
    const questionnaireResponses = await QuestionnaireResponse.find({ assessment: assessmentId })
      .populate('questionnaire', 'title version')
      .populate('submittedBy', 'username firstName lastName')
      .sort({ createdAt: 1 });

    // Get ROI calculation for this assessment
    const roiCalculation = await ROICalculation.findOne({ assessment: assessmentId });

    // Get recommendations for this assessment
    const recommendations = await Recommendation.find({ assessment: assessmentId })
      .sort({ priority: 1 });

    // Get benchmarks for this company's industry
    const benchmarks = assessment.company?.industry 
      ? await Benchmark.find({ industry: assessment.company.industry })
      : [];

    // Prepare analytics data
    const analyticsData: any = {
      assessment: {
        id: assessment._id,
        name: assessment.name,
        status: assessment.status,
        currentStage: assessment.currentStage,
        startDate: assessment.startDate,
        completionDate: assessment.completionDate,
        company: assessment.company ? {
          id: assessment.company._id,
          name: assessment.company.name,
          industry: assessment.company.industry,
          size: assessment.company.size
        } : null,
        warehouse: assessment.warehouse ? {
          id: assessment.warehouse._id,
          name: assessment.warehouse.name,
          type: assessment.warehouse.type,
          size: assessment.warehouse.size
        } : null,
        createdBy: assessment.createdBy ? {
          id: assessment.createdBy._id,
          username: assessment.createdBy.username,
          name: `${assessment.createdBy.firstName} ${assessment.createdBy.lastName}`.trim()
        } : null,
        assignedUsers: assessment.assignedUsers ? assessment.assignedUsers.map((user: any) => ({
          id: user._id,
          username: user.username,
          name: `${user.firstName} ${user.lastName}`.trim()
        })) : []
      },
      questionnaireData: {
        responseCount: questionnaireResponses.length,
        completionRate: 0,
        sectionScores: {},
        lastUpdated: questionnaireResponses.length > 0 
          ? questionnaireResponses[questionnaireResponses.length - 1].updatedAt 
          : null
      },
      roiData: roiCalculation ? {
        financialMetrics: roiCalculation.financialMetrics,
        operationalMetrics: roiCalculation.operationalMetrics,
        categoryScores: roiCalculation.categoryScores,
        createdAt: roiCalculation.createdAt,
        updatedAt: roiCalculation.updatedAt
      } : null,
      recommendationData: {
        count: recommendations.length,
        priorityDistribution: [0, 0, 0], // High, Medium, Low
        categoryDistribution: {},
        estimatedCostTotal: 0,
        estimatedImpactAverage: 0,
        topRecommendations: []
      },
      benchmarkComparison: []
    };

    // Process questionnaire data
    if (questionnaireResponses.length > 0) {
      // Calculate completion rate
      const completedResponses = questionnaireResponses.filter(
        response => response.status === 'completed'
      ).length;
      analyticsData.questionnaireData.completionRate = 
        (completedResponses / questionnaireResponses.length) * 100;
      
      // Calculate section scores
      const sectionScores: any = {};
      let totalSections = 0;
      
      questionnaireResponses.forEach(response => {
        if (response.sections) {
          response.sections.forEach(section => {
            if (section.score !== undefined) {
              if (!sectionScores[section.title]) {
                sectionScores[section.title] = {
                  scoreSum: 0,
                  count: 0
                };
              }
              sectionScores[section.title].scoreSum += section.score;
              sectionScores[section.title].count++;
              totalSections++;
            }
          });
        }
      });
      
      // Calculate average scores for each section
      Object.entries(sectionScores).forEach(([section, data]: [string, any]) => {
        analyticsData.questionnaireData.sectionScores[section] = 
          data.count > 0 ? data.scoreSum / data.count : 0;
      });
    }

    // Process recommendation data
    if (recommendations.length > 0) {
      // Process priority distribution
      recommendations.forEach(rec => {
        if (rec.priority >= 1 && rec.priority <= 3) {
          analyticsData.recommendationData.priorityDistribution[rec.priority - 1]++;
        }
        
        // Process category distribution
        if (rec.category) {
          if (!analyticsData.recommendationData.categoryDistribution[rec.category]) {
            analyticsData.recommendationData.categoryDistribution[rec.category] = 0;
          }
          analyticsData.recommendationData.categoryDistribution[rec.category]++;
        }
        
        // Sum estimated costs
        analyticsData.recommendationData.estimatedCostTotal += rec.estimatedCost || 0;
      });
      
      // Calculate average estimated impact
      const totalImpact = recommendations.reduce((sum, rec) => 
        sum + (rec.estimatedImpact || 0), 0);
      analyticsData.recommendationData.estimatedImpactAverage = 
        recommendations.length > 0 ? totalImpact / recommendations.length : 0;
      
      // Get top recommendations (priority 1)
      analyticsData.recommendationData.topRecommendations = recommendations
        .filter(rec => rec.priority === 1)
        .map(rec => ({
          id: rec._id,
          title: rec.title,
          description: rec.description,
          category: rec.category,
          estimatedCost: rec.estimatedCost,
          estimatedTimeline: rec.estimatedTimeline,
          estimatedImpact: rec.estimatedImpact
        }));
    }

    // Process benchmark comparison
    if (benchmarks.length > 0 && roiCalculation) {
      // Group benchmarks by category
      const benchmarksByCategory: any = {};
      
      benchmarks.forEach(benchmark => {
        if (!benchmarksByCategory[benchmark.category]) {
          benchmarksByCategory[benchmark.category] = {
            category: benchmark.category,
            industryAverage: benchmark.value,
            assessmentValue: 0,
            difference: 0,
            unit: benchmark.unit
          };
        }
      });
      
      // Get assessment values for each benchmark category
      if (roiCalculation.operationalMetrics) {
        Object.entries(roiCalculation.operationalMetrics).forEach(([metric, data]: [string, any]) => {
          if (benchmarksByCategory[metric] && data.current) {
            benchmarksByCategory[metric].assessmentValue = data.current;
            benchmarksByCategory[metric].difference = data.current - benchmarksByCategory[metric].industryAverage;
          }
        });
      }
      
      analyticsData.benchmarkComparison = Object.values(benchmarksByCategory);
    }

    // Return analytics data
    return NextResponse.json(analyticsData);
  } catch (error) {
    console.error('Error fetching assessment analytics data:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
