import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Assessment from '@/models/Assessment';
import ROICalculation from '@/models/ROICalculation';
import Benchmark from '@/models/Benchmark';
import Company from '@/models/Company';
import { withAuthAppRouter } from '@/lib/auth';

// Get analytics data
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId');
    const industry = url.searchParams.get('industry');
    const category = url.searchParams.get('category');
    const timeframe = url.searchParams.get('timeframe') || '12months'; // Default to 12 months
    
    // Connect to the database
    await connectToDatabase();

    // Build query based on user role
    const isAdmin = user.role === 'admin';
    let assessmentQuery: any = isAdmin ? {} : { $or: [
      { createdBy: user.userId },
      { assignedUsers: user.userId }
    ]};

    // Apply company filter if provided
    if (companyId) {
      if (isAdmin) {
        // Admin can filter by any company
        assessmentQuery.company = companyId;
      } else {
        // Regular users can only filter by companies they have access to
        assessmentQuery.$or = [
          { createdBy: user.userId, company: companyId },
          { assignedUsers: user.userId, company: companyId }
        ];
      }
    }

    // Apply time filter
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
      case '30days':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(now.getDate() - 90);
        break;
      case '6months':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case '12months':
      default:
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'alltime':
        startDate = new Date(0); // Beginning of time
        break;
    }
    
    assessmentQuery.createdAt = { $gte: startDate };

    // Get assessments
    const assessments = await Assessment.find(assessmentQuery)
      .populate('company', 'name industry size')
      .populate('warehouse', 'name type size')
      .sort({ createdAt: 1 });

    // Get assessment IDs
    const assessmentIds = assessments.map(a => a._id);

    // Get ROI calculations for these assessments
    const roiCalculations = await ROICalculation.find({
      assessment: { $in: assessmentIds }
    }).populate('assessment');

    // Get benchmarks based on filters
    const benchmarkQuery: any = {};
    if (industry) {
      benchmarkQuery.industry = industry;
    }
    if (category) {
      benchmarkQuery.category = category;
    }
    
    const benchmarks = await Benchmark.find(benchmarkQuery);

    // Prepare analytics data
    const analyticsData: any = {
      timeSeriesData: {
        assessments: [],
        roi: []
      },
      comparisonData: {
        byIndustry: {},
        byCompanySize: {},
        byWarehouseType: {}
      },
      benchmarkData: {},
      distributionData: {
        roiDistribution: [0, 0, 0, 0, 0], // <0%, 0-10%, 10-20%, 20-50%, >50%
        paybackDistribution: [0, 0, 0, 0, 0] // <3mo, 3-6mo, 6-12mo, 12-24mo, >24mo
      }
    };

    // Process time series data
    const monthlyData: any = {};
    
    // Initialize monthly data for the entire timeframe
    let currentDate = new Date(startDate);
    while (currentDate <= now) {
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

    // Process industry comparison data
    const industryData: any = {};
    const companySizeData: any = {};
    const warehouseTypeData: any = {};
    
    roiCalculations.forEach(calc => {
      const assessment = calc.assessment as any;
      if (!assessment || !assessment.company) return;
      
      const industry = assessment.company.industry;
      const companySize = assessment.company.size;
      const warehouseType = assessment.warehouse?.type;
      
      if (industry && calc.financialMetrics?.roi) {
        if (!industryData[industry]) {
          industryData[industry] = {
            roiSum: 0,
            roiCount: 0,
            savingsSum: 0,
            investmentSum: 0
          };
        }
        industryData[industry].roiSum += calc.financialMetrics.roi;
        industryData[industry].roiCount++;
        industryData[industry].savingsSum += calc.financialMetrics.annualSavings || 0;
        industryData[industry].investmentSum += calc.financialMetrics.totalInvestment || 0;
      }
      
      if (companySize && calc.financialMetrics?.roi) {
        if (!companySizeData[companySize]) {
          companySizeData[companySize] = {
            roiSum: 0,
            roiCount: 0,
            savingsSum: 0,
            investmentSum: 0
          };
        }
        companySizeData[companySize].roiSum += calc.financialMetrics.roi;
        companySizeData[companySize].roiCount++;
        companySizeData[companySize].savingsSum += calc.financialMetrics.annualSavings || 0;
        companySizeData[companySize].investmentSum += calc.financialMetrics.totalInvestment || 0;
      }
      
      if (warehouseType && calc.financialMetrics?.roi) {
        if (!warehouseTypeData[warehouseType]) {
          warehouseTypeData[warehouseType] = {
            roiSum: 0,
            roiCount: 0,
            savingsSum: 0,
            investmentSum: 0
          };
        }
        warehouseTypeData[warehouseType].roiSum += calc.financialMetrics.roi;
        warehouseTypeData[warehouseType].roiCount++;
        warehouseTypeData[warehouseType].savingsSum += calc.financialMetrics.annualSavings || 0;
        warehouseTypeData[warehouseType].investmentSum += calc.financialMetrics.totalInvestment || 0;
      }
    });

    // Calculate averages for comparison data
    analyticsData.comparisonData.byIndustry = Object.entries(industryData).map(([industry, data]: [string, any]) => ({
      industry,
      averageROI: data.roiCount > 0 ? data.roiSum / data.roiCount : 0,
      averageSavings: data.roiCount > 0 ? data.savingsSum / data.roiCount : 0,
      averageInvestment: data.roiCount > 0 ? data.investmentSum / data.roiCount : 0,
      count: data.roiCount
    }));

    analyticsData.comparisonData.byCompanySize = Object.entries(companySizeData).map(([size, data]: [string, any]) => ({
      size,
      averageROI: data.roiCount > 0 ? data.roiSum / data.roiCount : 0,
      averageSavings: data.roiCount > 0 ? data.savingsSum / data.roiCount : 0,
      averageInvestment: data.roiCount > 0 ? data.investmentSum / data.roiCount : 0,
      count: data.roiCount
    }));

    analyticsData.comparisonData.byWarehouseType = Object.entries(warehouseTypeData).map(([type, data]: [string, any]) => ({
      type,
      averageROI: data.roiCount > 0 ? data.roiSum / data.roiCount : 0,
      averageSavings: data.roiCount > 0 ? data.savingsSum / data.roiCount : 0,
      averageInvestment: data.roiCount > 0 ? data.investmentSum / data.roiCount : 0,
      count: data.roiCount
    }));

    // Process benchmark data
    const benchmarksByCategory: any = {};
    
    benchmarks.forEach(benchmark => {
      if (!benchmarksByCategory[benchmark.category]) {
        benchmarksByCategory[benchmark.category] = [];
      }
      benchmarksByCategory[benchmark.category].push({
        industry: benchmark.industry,
        companySize: benchmark.companySize,
        value: benchmark.value,
        unit: benchmark.unit,
        description: benchmark.description
      });
    });
    
    analyticsData.benchmarkData = benchmarksByCategory;

    // Process distribution data
    roiCalculations.forEach(calc => {
      if (calc.financialMetrics?.roi) {
        const roi = calc.financialMetrics.roi;
        if (roi < 0) {
          analyticsData.distributionData.roiDistribution[0]++;
        } else if (roi < 10) {
          analyticsData.distributionData.roiDistribution[1]++;
        } else if (roi < 20) {
          analyticsData.distributionData.roiDistribution[2]++;
        } else if (roi < 50) {
          analyticsData.distributionData.roiDistribution[3]++;
        } else {
          analyticsData.distributionData.roiDistribution[4]++;
        }
      }
      
      if (calc.financialMetrics?.paybackPeriod) {
        const payback = calc.financialMetrics.paybackPeriod;
        if (payback < 3) {
          analyticsData.distributionData.paybackDistribution[0]++;
        } else if (payback < 6) {
          analyticsData.distributionData.paybackDistribution[1]++;
        } else if (payback < 12) {
          analyticsData.distributionData.paybackDistribution[2]++;
        } else if (payback < 24) {
          analyticsData.distributionData.paybackDistribution[3]++;
        } else {
          analyticsData.distributionData.paybackDistribution[4]++;
        }
      }
    });

    // Add distribution labels
    analyticsData.distributionData.roiLabels = ['<0%', '0-10%', '10-20%', '20-50%', '>50%'];
    analyticsData.distributionData.paybackLabels = ['<3mo', '3-6mo', '6-12mo', '12-24mo', '>24mo'];

    // Return analytics data
    return NextResponse.json(analyticsData);
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
