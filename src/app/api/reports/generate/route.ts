import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import Assessment from '@/models/Assessment';
import ROICalculation from '@/models/ROICalculation';
import Recommendation from '@/models/Recommendation';
import Company from '@/models/Company';
import Warehouse from '@/models/Warehouse';
import { withAuthAppRouter } from '@/lib/auth';
import { generateDocxReport, ReportData } from '@/lib/reportGenerator';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Generate and download a report
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const { reportId } = await req.json();

    if (!reportId) {
      return NextResponse.json(
        { message: 'Report ID is required' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the report with populated references
    const report = await Report.findById(reportId)
      .populate('assessment')
      .populate('roiCalculation')
      .populate({
        path: 'recommendations',
        options: { sort: { priority: 1 } }
      });

    if (!report) {
      return NextResponse.json(
        { message: 'Report not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this report
    const assessment = report.assessment as any;
    if (!assessment) {
      return NextResponse.json(
        { message: 'Assessment not found for this report' },
        { status: 404 }
      );
    }

    // Check if user is admin or has access to the assessment
    const isAdmin = user.role === 'admin';
    const isCreator = assessment.createdBy.toString() === user.userId;
    const isAssigned = assessment.assignedUsers?.some(
      (assignedUser: any) => assignedUser.toString() === user.userId
    );

    if (!isAdmin && !isCreator && !isAssigned) {
      return NextResponse.json(
        { message: 'You do not have permission to access this report' },
        { status: 403 }
      );
    }

    // Get company and warehouse details
    const company = await Company.findById(assessment.company);
    const warehouse = await Warehouse.findById(assessment.warehouse);

    if (!company || !warehouse) {
      return NextResponse.json(
        { message: 'Company or warehouse not found for this assessment' },
        { status: 404 }
      );
    }

    // Get ROI calculation details
    const roiCalculation = report.roiCalculation as any;
    if (!roiCalculation) {
      return NextResponse.json(
        { message: 'ROI calculation not found for this report' },
        { status: 404 }
      );
    }

    // Get recommendations
    const recommendations = report.recommendations as any[];

    // Prepare chart data
    const charts: { [key: string]: any } = {
      // ROI Chart
      roiChart: {
        type: 'bar',
        data: {
          labels: ['Investment', 'Annual Savings', 'NPV'],
          datasets: [
            {
              label: 'Financial Metrics',
              data: [
                roiCalculation.financialMetrics.totalInvestment,
                roiCalculation.financialMetrics.annualSavings,
                roiCalculation.financialMetrics.npv
              ],
              backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'ROI Financial Analysis'
            }
          }
        }
      },
      
      // Category Scores Chart
      categoryScoresChart: {
        type: 'radar',
        data: {
          labels: Object.keys(roiCalculation.categoryScores),
          datasets: [
            {
              label: 'Category Scores',
              data: Object.values(roiCalculation.categoryScores),
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              borderColor: 'rgb(54, 162, 235)',
              pointBackgroundColor: 'rgb(54, 162, 235)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgb(54, 162, 235)'
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Assessment Category Scores'
            }
          },
          scales: {
            r: {
              min: 0,
              max: 100,
              ticks: {
                stepSize: 20
              }
            }
          }
        }
      }
    };

    // Prepare report data
    const reportData: ReportData = {
      title: report.title,
      company: {
        name: company.name,
        industry: company.industry,
        size: company.size
      },
      warehouse: {
        name: warehouse.name,
        type: warehouse.type,
        size: warehouse.size,
        location: warehouse.location
      },
      assessment: {
        name: assessment.name,
        startDate: assessment.startDate,
        completionDate: assessment.completionDate || new Date()
      },
      roiCalculation: {
        financialMetrics: roiCalculation.financialMetrics,
        operationalMetrics: roiCalculation.operationalMetrics,
        categoryScores: roiCalculation.categoryScores
      },
      recommendations: recommendations.map((rec: any) => ({
        title: rec.title,
        description: rec.description,
        category: rec.category,
        priority: rec.priority,
        implementationSteps: rec.implementationSteps,
        estimatedCost: rec.estimatedCost,
        estimatedTimeline: rec.estimatedTimeline,
        estimatedImpact: rec.estimatedImpact
      })),
      charts
    };

    // Generate the report
    const reportBuffer = await generateDocxReport(reportData);

    // Save the report to a temporary file
    const tempDir = path.join(os.tmpdir(), 'roi-reports');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const filename = `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`;
    const filePath = path.join(tempDir, filename);
    
    fs.writeFileSync(filePath, reportBuffer);

    // Update report download count
    report.downloadCount = (report.downloadCount || 0) + 1;
    report.lastDownloadedAt = new Date();
    await report.save();

    // Return the report file
    const fileBuffer = fs.readFileSync(filePath);
    
    // Clean up the temporary file
    fs.unlinkSync(filePath);

    // Return the file as a downloadable attachment
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { message: 'Error generating report', error: (error as Error).message },
      { status: 500 }
    );
  }
});
