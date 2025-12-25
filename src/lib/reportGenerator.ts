import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, ImageRun } from 'docx';
import { Chart } from 'chart.js/auto';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import fs from 'fs';
import path from 'path';

// Types for report data
export interface ReportData {
  title: string;
  company: {
    name: string;
    industry: string;
    size: string;
  };
  warehouse: {
    name: string;
    type: string;
    size: number;
    location: {
      address: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
  };
  assessment: {
    name: string;
    startDate: Date;
    completionDate: Date;
  };
  roiCalculation: {
    financialMetrics: {
      totalInvestment: number;
      annualSavings: number;
      paybackPeriod: number;
      roi: number;
      npv: number;
      irr: number;
    };
    operationalMetrics: {
      [key: string]: {
        current: number;
        target: number;
        improvement: number;
        unit: string;
      };
    };
    categoryScores: {
      [key: string]: number;
    };
  };
  recommendations: Array<{
    title: string;
    description: string;
    category: string;
    priority: number;
    implementationSteps: string[];
    estimatedCost: number;
    estimatedTimeline: string;
    estimatedImpact: number;
  }>;
  charts: {
    [key: string]: any; // Chart configuration
  };
}

// Function to generate a chart image
async function generateChartImage(chartConfig: any, width = 600, height = 400): Promise<Buffer> {
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });
  return await chartJSNodeCanvas.renderToBuffer(chartConfig);
}

// Function to format currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

// Function to format percentage
function formatPercentage(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(value / 100);
}

// Function to generate a DOCX report
export async function generateDocxReport(reportData: ReportData): Promise<Buffer> {
  // Generate chart images
  const chartImages: { [key: string]: Buffer } = {};
  for (const [key, chartConfig] of Object.entries(reportData.charts)) {
    chartImages[key] = await generateChartImage(chartConfig);
  }

  // Create document
  const doc = new Document({
    title: reportData.title,
    description: `ROI Assessment Report for ${reportData.company.name} - ${reportData.warehouse.name}`,
    styles: {
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            size: 24, // 12pt
            font: 'Calibri',
          },
          paragraph: {
            spacing: {
              line: 276, // 1.15 line spacing
            },
          },
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            size: 32, // 16pt
            bold: true,
            font: 'Calibri',
            color: '2E74B5',
          },
          paragraph: {
            spacing: {
              before: 240, // 12pt before
              after: 120, // 6pt after
            },
          },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            size: 28, // 14pt
            bold: true,
            font: 'Calibri',
            color: '2E74B5',
          },
          paragraph: {
            spacing: {
              before: 200, // 10pt before
              after: 100, // 5pt after
            },
          },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            size: 26, // 13pt
            bold: true,
            font: 'Calibri',
            color: '2E74B5',
          },
          paragraph: {
            spacing: {
              before: 160, // 8pt before
              after: 80, // 4pt after
            },
          },
        },
      ],
    },
  });

  // Create sections
  const sections = [
    // Cover page
    new Paragraph({
      text: reportData.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: {
        before: 3000, // Space at the top
        after: 400,
      },
    }),
    new Paragraph({
      text: `${reportData.company.name} - ${reportData.warehouse.name}`,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: {
        after: 200,
      },
    }),
    new Paragraph({
      text: `Generated on ${new Date().toLocaleDateString()}`,
      alignment: AlignmentType.CENTER,
      spacing: {
        after: 3000, // Space at the bottom
      },
    }),
    new Paragraph({
      text: '', // Page break
      pageBreakBefore: true,
    }),

    // Executive Summary
    new Paragraph({
      text: 'Executive Summary',
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      text: `This report presents the findings of the ROI assessment conducted for ${reportData.company.name}'s ${reportData.warehouse.name} warehouse. The assessment was conducted from ${new Date(reportData.assessment.startDate).toLocaleDateString()} to ${new Date(reportData.assessment.completionDate).toLocaleDateString()}.`,
    }),
    new Paragraph({
      text: 'Key Financial Metrics:',
      heading: HeadingLevel.HEADING_2,
    }),
  ];

  // Financial metrics table
  const financialMetricsTable = new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      bottom: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      left: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      right: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      insideHorizontal: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      insideVertical: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: {
              size: 50,
              type: WidthType.PERCENTAGE,
            },
            children: [new Paragraph({ text: 'Metric', bold: true })],
          }),
          new TableCell({
            width: {
              size: 50,
              type: WidthType.PERCENTAGE,
            },
            children: [new Paragraph({ text: 'Value', bold: true })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph('Total Investment')],
          }),
          new TableCell({
            children: [new Paragraph(formatCurrency(reportData.roiCalculation.financialMetrics.totalInvestment))],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph('Annual Savings')],
          }),
          new TableCell({
            children: [new Paragraph(formatCurrency(reportData.roiCalculation.financialMetrics.annualSavings))],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph('Payback Period')],
          }),
          new TableCell({
            children: [new Paragraph(`${reportData.roiCalculation.financialMetrics.paybackPeriod.toFixed(1)} months`)],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph('ROI')],
          }),
          new TableCell({
            children: [new Paragraph(formatPercentage(reportData.roiCalculation.financialMetrics.roi))],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph('Net Present Value (NPV)')],
          }),
          new TableCell({
            children: [new Paragraph(formatCurrency(reportData.roiCalculation.financialMetrics.npv))],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph('Internal Rate of Return (IRR)')],
          }),
          new TableCell({
            children: [new Paragraph(formatPercentage(reportData.roiCalculation.financialMetrics.irr))],
          }),
        ],
      }),
    ],
  });

  sections.push(financialMetricsTable);

  // ROI Chart
  if (chartImages['roiChart']) {
    sections.push(
      new Paragraph({
        text: 'ROI Analysis',
        heading: HeadingLevel.HEADING_2,
        spacing: {
          before: 400,
        },
      }),
      new Paragraph({
        children: [
          new ImageRun({
            data: chartImages['roiChart'],
            transformation: {
              width: 500,
              height: 300,
            },
          }),
        ],
        alignment: AlignmentType.CENTER,
      })
    );
  }

  // Top Recommendations
  sections.push(
    new Paragraph({
      text: 'Top Recommendations',
      heading: HeadingLevel.HEADING_2,
      spacing: {
        before: 400,
      },
    })
  );

  // Sort recommendations by priority
  const sortedRecommendations = [...reportData.recommendations].sort((a, b) => a.priority - b.priority);
  const topRecommendations = sortedRecommendations.slice(0, 3);

  topRecommendations.forEach((recommendation, index) => {
    sections.push(
      new Paragraph({
        text: `${index + 1}. ${recommendation.title}`,
        heading: HeadingLevel.HEADING_3,
      }),
      new Paragraph({
        text: recommendation.description,
      }),
      new Paragraph({
        text: `Priority: ${recommendation.priority} | Estimated Cost: ${formatCurrency(recommendation.estimatedCost)} | Timeline: ${recommendation.estimatedTimeline}`,
        spacing: {
          after: 200,
        },
      })
    );
  });

  // Page break before detailed sections
  sections.push(
    new Paragraph({
      text: '',
      pageBreakBefore: true,
    })
  );

  // Company and Warehouse Details
  sections.push(
    new Paragraph({
      text: 'Assessment Details',
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      text: 'Company Information',
      heading: HeadingLevel.HEADING_2,
    })
  );

  // Company details table
  const companyTable = new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      bottom: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      left: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      right: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      insideHorizontal: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      insideVertical: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: 'Company Name', bold: true })],
          }),
          new TableCell({
            children: [new Paragraph(reportData.company.name)],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: 'Industry', bold: true })],
          }),
          new TableCell({
            children: [new Paragraph(reportData.company.industry)],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: 'Size', bold: true })],
          }),
          new TableCell({
            children: [new Paragraph(reportData.company.size)],
          }),
        ],
      }),
    ],
  });

  sections.push(companyTable);

  // Warehouse information
  sections.push(
    new Paragraph({
      text: 'Warehouse Information',
      heading: HeadingLevel.HEADING_2,
      spacing: {
        before: 400,
      },
    })
  );

  // Warehouse details table
  const warehouseTable = new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      bottom: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      left: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      right: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      insideHorizontal: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      insideVertical: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: 'Warehouse Name', bold: true })],
          }),
          new TableCell({
            children: [new Paragraph(reportData.warehouse.name)],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: 'Type', bold: true })],
          }),
          new TableCell({
            children: [new Paragraph(reportData.warehouse.type)],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: 'Size', bold: true })],
          }),
          new TableCell({
            children: [new Paragraph(`${reportData.warehouse.size.toLocaleString()} sq ft`)],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: 'Location', bold: true })],
          }),
          new TableCell({
            children: [
              new Paragraph(
                `${reportData.warehouse.location.address}, ${reportData.warehouse.location.city}, ${reportData.warehouse.location.state} ${reportData.warehouse.location.zipCode}, ${reportData.warehouse.location.country}`
              ),
            ],
          }),
        ],
      }),
    ],
  });

  sections.push(warehouseTable);

  // Page break before operational metrics
  sections.push(
    new Paragraph({
      text: '',
      pageBreakBefore: true,
    })
  );

  // Operational Metrics
  sections.push(
    new Paragraph({
      text: 'Operational Metrics',
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      text: 'The following table shows the current operational metrics and the target improvements:',
    })
  );

  // Operational metrics table
  const operationalMetricsRows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          children: [new Paragraph({ text: 'Metric', bold: true })],
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Current', bold: true })],
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Target', bold: true })],
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Improvement', bold: true })],
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Unit', bold: true })],
        }),
      ],
    }),
  ];

  // Add rows for each operational metric
  Object.entries(reportData.roiCalculation.operationalMetrics).forEach(([key, metric]) => {
    operationalMetricsRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph(key)],
          }),
          new TableCell({
            children: [new Paragraph(metric.current.toString())],
          }),
          new TableCell({
            children: [new Paragraph(metric.target.toString())],
          }),
          new TableCell({
            children: [new Paragraph(metric.improvement.toString())],
          }),
          new TableCell({
            children: [new Paragraph(metric.unit)],
          }),
        ],
      })
    );
  });

  const operationalMetricsTable = new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      bottom: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      left: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      right: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      insideHorizontal: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
      insideVertical: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '000000',
      },
    },
    rows: operationalMetricsRows,
  });

  sections.push(operationalMetricsTable);

  // Category Scores
  if (Object.keys(reportData.roiCalculation.categoryScores).length > 0) {
    sections.push(
      new Paragraph({
        text: 'Category Scores',
        heading: HeadingLevel.HEADING_2,
        spacing: {
          before: 400,
        },
      }),
      new Paragraph({
        text: 'The following chart shows the scores for each assessment category:',
      })
    );

    // Category scores chart
    if (chartImages['categoryScoresChart']) {
      sections.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: chartImages['categoryScoresChart'],
              transformation: {
                width: 500,
                height: 300,
              },
            }),
          ],
          alignment: AlignmentType.CENTER,
        })
      );
    }
  }

  // Page break before recommendations
  sections.push(
    new Paragraph({
      text: '',
      pageBreakBefore: true,
    })
  );

  // Detailed Recommendations
  sections.push(
    new Paragraph({
      text: 'Detailed Recommendations',
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      text: 'Based on the assessment, the following recommendations are provided to improve warehouse operations and achieve the projected ROI:',
    })
  );

  // Add all recommendations
  reportData.recommendations.forEach((recommendation, index) => {
    sections.push(
      new Paragraph({
        text: `${index + 1}. ${recommendation.title}`,
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({
        text: recommendation.description,
      }),
      new Paragraph({
        text: `Category: ${recommendation.category}`,
      }),
      new Paragraph({
        text: `Priority: ${recommendation.priority} (${recommendation.priority === 1 ? 'High' : recommendation.priority === 2 ? 'Medium' : 'Low'})`,
      }),
      new Paragraph({
        text: `Estimated Cost: ${formatCurrency(recommendation.estimatedCost)}`,
      }),
      new Paragraph({
        text: `Estimated Timeline: ${recommendation.estimatedTimeline}`,
      }),
      new Paragraph({
        text: `Estimated Impact: ${formatPercentage(recommendation.estimatedImpact)}`,
      }),
      new Paragraph({
        text: 'Implementation Steps:',
        bold: true,
      })
    );

    // Implementation steps
    recommendation.implementationSteps.forEach((step, stepIndex) => {
      sections.push(
        new Paragraph({
          text: `${stepIndex + 1}. ${step}`,
          indent: {
            left: 720, // 0.5 inch indent
          },
        })
      );
    });

    // Add spacing after each recommendation except the last one
    if (index < reportData.recommendations.length - 1) {
      sections.push(
        new Paragraph({
          text: '',
          spacing: {
            after: 200,
          },
        })
      );
    }
  });

  // Add all sections to the document
  doc.addSection({
    children: sections,
  });

  // Generate the document
  return await Packer.toBuffer(doc);
}

// Function to save a report to file
export async function saveReportToFile(reportData: ReportData, filePath: string): Promise<string> {
  const buffer = await generateDocxReport(reportData);
  
  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Write file
  fs.writeFileSync(filePath, buffer);
  
  return filePath;
}
