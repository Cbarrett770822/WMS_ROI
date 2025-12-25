import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Assessment from '@/models/Assessment';
import ROICalculation from '@/models/ROICalculation';
import Benchmark from '@/models/Benchmark';
import Company from '@/models/Company';
import Warehouse from '@/models/Warehouse';
import { withAuthAppRouter } from '@/lib/auth';
import mongoose from 'mongoose';

// Get company-specific analytics data
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const companyId = req.url.split('/').pop();
    
    if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return NextResponse.json(
        { message: 'Invalid company ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Check if user has access to this company
    const company = await Company.findById(companyId);
    if (!company) {
      return NextResponse.json(
        { message: 'Company not found' },
        { status: 404 }
      );
    }

    // Check user permissions
    const isAdmin = user.role === 'admin';
    if (!isAdmin) {
      // Check if user is assigned to this company
      const hasAccess = await Assessment.exists({
        company: companyId,
        $or: [
          { createdBy: user.userId },
          { assignedUsers: user.userId }
        ]
      });

      if (!hasAccess) {
        return NextResponse.json(
          { message: 'You do not have permission to access analytics for this company' },
          { status: 403 }
        );
      }
    }

    // Get warehouses for this company
    const warehouses = await Warehouse.find({ company: companyId });
    const warehouseIds = warehouses.map(w => w._id);

    // Get assessments for this company
    const assessments = await Assessment.find({ company: companyId })
      .populate('warehouse', 'name type size')
      .sort({ createdAt: 1 });

    // Get assessment IDs
    const assessmentIds = assessments.map(a => a._id);

    // Get ROI calculations for these assessments
    const roiCalculations = await ROICalculation.find({
      assessment: { $in: assessmentIds }
    }).populate('assessment');

    // Get benchmarks for this company's industry
    const benchmarks = await Benchmark.find({
      industry: company.industry
    });

    // Prepare analytics data
    const analyticsData: any = {
      company: {
        id: company._id,
        name: company.name,
        industry: company.industry,
        size: company.size
      },
      summary: {
        warehouseCount: warehouses.length,
        assessmentCount: assessments.length,
        roiCalculationCount: roiCalculations.length,
        averageROI: 0,
        totalInvestment: 0,
        totalSavings: 0,
        averagePaybackPeriod: 0
      },
      timeSeriesData: {
        assessments: [],
        roi: []
      },
      warehouseComparison: [],
      categoryScores: {},
      benchmarkComparison: [],
      recommendations: {
        priorityDistribution: [0, 0, 0], // High, Medium, Low
        categoryDistribution: {}
      }
    };

    // Calculate summary metrics
    if (roiCalculations.length > 0) {
      const totalROI = roiCalculations.reduce((sum, calc) => 
        sum + (calc.financialMetrics?.roi || 0), 0);
      analyticsData.summary.averageROI = totalROI / roiCalculations.length;
      
      analyticsData.summary.totalInvestment = roiCalculations.reduce((sum, calc) => 
        sum + (calc.financialMetrics?.totalInvestment || 0), 0);
      
      analyticsData.summary.totalSavings = roiCalculations.reduce((sum, calc) => 
        sum + (calc.financialMetrics?.annualSavings || 0), 0);
      
      const totalPayback = roiCalculations.reduce((sum, calc) => 
        sum + (calc.financialMetrics?.paybackPeriod || 0), 0);
      analyticsData.summary.averagePaybackPeriod = totalPayback / roiCalculations.length;
    }

    // Process time series data
    const monthlyData: any = {};
    
    // Get date range from assessments
    let startDate = new Date();
    let endDate = new Date(0);
    
    assessments.forEach(assessment => {
      const date = new Date(assessment.createdAt);
      if (date < startDate) startDate = date;
      if (date > endDate) endDate = date;
    });
    
    // Ensure we have at least a 12-month range
    if (endDate.getTime() - startDate.getTime() < 31536000000) { // Less than a year
      startDate = new Date(endDate);
      startDate.setFullYear(startDate.getFullYear() - 1);
    }

    // Initialize monthly data for the entire timeframe
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[monthKey] = {
        assessmentCount: 0,
        roiSum: 0,
        roiCount: 0
      };
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Populate assessment counts
    assessments.forEach(assessment => {
      const date = new Date(assessment.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].assessmentCount++;
      }
    });

    // Populate ROI data
    roiCalculations.forEach(calc => {
      if (calc.createdAt && calc.financialMetrics?.roi) {
        const date = new Date(calc.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].roiSum += calc.financialMetrics.roi;
          monthlyData[monthKey].roiCount++;
        }
      }
    });

    // Convert monthly data to arrays for charts
    analyticsData.timeSeriesData.labels = Object.keys(monthlyData);
    analyticsData.timeSeriesData.assessments = analyticsData.timeSeriesData.labels.map(
      month => monthlyData[month].assessmentCount
    );
    analyticsData.timeSeriesData.roi = analyticsData.timeSeriesData.labels.map(
      month => monthlyData[month].roiCount > 0 
        ? monthlyData[month].roiSum / monthlyData[month].roiCount 
        : 0
    );

    // Process warehouse comparison data
    const warehouseData: any = {};
    
    roiCalculations.forEach(calc => {
      const assessment = calc.assessment as any;
      if (!assessment || !assessment.warehouse) return;
      
      const warehouseId = assessment.warehouse._id.toString();
      const warehouseName = assessment.warehouse.name;
      
      if (!warehouseData[warehouseId]) {
        warehouseData[warehouseId] = {
          id: warehouseId,
          name: warehouseName,
          type: assessment.warehouse.type,
          size: assessment.warehouse.size,
          roiSum: 0,
          roiCount: 0,
          savingsSum: 0,
          investmentSum: 0,
          paybackSum: 0
        };
      }
      
      if (calc.financialMetrics) {
        warehouseData[warehouseId].roiSum += calc.financialMetrics.roi || 0;
        warehouseData[warehouseId].savingsSum += calc.financialMetrics.annualSavings || 0;
        warehouseData[warehouseId].investmentSum += calc.financialMetrics.totalInvestment || 0;
        warehouseData[warehouseId].paybackSum += calc.financialMetrics.paybackPeriod || 0;
        warehouseData[warehouseId].roiCount++;
      }
    });

    // Calculate averages for warehouse comparison
    analyticsData.warehouseComparison = Object.values(warehouseData).map((data: any) => ({
      id: data.id,
      name: data.name,
      type: data.type,
      size: data.size,
      averageROI: data.roiCount > 0 ? data.roiSum / data.roiCount : 0,
      averageSavings: data.roiCount > 0 ? data.savingsSum / data.roiCount : 0,
      averageInvestment: data.roiCount > 0 ? data.investmentSum / data.roiCount : 0,
      averagePayback: data.roiCount > 0 ? data.paybackSum / data.roiCount : 0,
      assessmentCount: data.roiCount
    }));

    // Process category scores
    const categoryScoreData: any = {};
    
    roiCalculations.forEach(calc => {
      if (calc.categoryScores) {
        Object.entries(calc.categoryScores).forEach(([category, score]) => {
          if (!categoryScoreData[category]) {
            categoryScoreData[category] = {
              scoreSum: 0,
              count: 0
            };
          }
          categoryScoreData[category].scoreSum += score as number;
          categoryScoreData[category].count++;
        });
      }
    });
    
    // Calculate average category scores
    Object.entries(categoryScoreData).forEach(([category, data]: [string, any]) => {
      analyticsData.categoryScores[category] = data.count > 0 
        ? data.scoreSum / data.count 
        : 0;
    });

    // Process benchmark comparison
    if (benchmarks.length > 0) {
      // Group benchmarks by category
      const benchmarksByCategory: any = {};
      
      benchmarks.forEach(benchmark => {
        if (!benchmarksByCategory[benchmark.category]) {
          benchmarksByCategory[benchmark.category] = {
            category: benchmark.category,
            industryAverage: benchmark.value,
            companyAverage: 0,
            difference: 0,
            unit: benchmark.unit
          };
        }
      });
      
      // Calculate company averages for each benchmark category
      roiCalculations.forEach(calc => {
        if (calc.operationalMetrics) {
          Object.entries(calc.operationalMetrics).forEach(([metric, data]: [string, any]) => {
            if (benchmarksByCategory[metric] && data.current) {
              if (!benchmarksByCategory[metric].companySum) {
                benchmarksByCategory[metric].companySum = 0;
                benchmarksByCategory[metric].companyCount = 0;
              }
              benchmarksByCategory[metric].companySum += data.current;
              benchmarksByCategory[metric].companyCount++;
            }
          });
        }
      });
      
      // Calculate final averages and differences
      Object.values(benchmarksByCategory).forEach((benchmark: any) => {
        if (benchmark.companyCount > 0) {
          benchmark.companyAverage = benchmark.companySum / benchmark.companyCount;
          benchmark.difference = benchmark.companyAverage - benchmark.industryAverage;
        }
        delete benchmark.companySum;
        delete benchmark.companyCount;
      });
      
      analyticsData.benchmarkComparison = Object.values(benchmarksByCategory);
    }

    // Process recommendation data
    if (assessmentIds.length > 0) {
      // Get recommendations for these assessments
      const recommendations = await mongoose.model('Recommendation').find({
        assessment: { $in: assessmentIds }
      });
      
      // Process priority distribution
      recommendations.forEach(rec => {
        if (rec.priority >= 1 && rec.priority <= 3) {
          analyticsData.recommendations.priorityDistribution[rec.priority - 1]++;
        }
        
        // Process category distribution
        if (rec.category) {
          if (!analyticsData.recommendations.categoryDistribution[rec.category]) {
            analyticsData.recommendations.categoryDistribution[rec.category] = 0;
          }
          analyticsData.recommendations.categoryDistribution[rec.category]++;
        }
      });
    }

    // Return analytics data
    return NextResponse.json(analyticsData);
  } catch (error) {
    console.error('Error fetching company analytics data:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
