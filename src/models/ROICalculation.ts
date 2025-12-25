import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for metric values
interface IMetricValue {
  current: number;
  target: number;
  industry: number;
  potential: number;
}

// Interface for financial impact
interface IFinancialImpact {
  annualSavings: number;
  implementationCost: number;
  paybackPeriod: number;
  fiveYearROI: number;
}

// Interface for category metrics
interface ICategoryMetrics {
  categoryId: string;
  categoryName: string;
  metrics: {
    metricId: string;
    metricName: string;
    values: IMetricValue;
    financialImpact: IFinancialImpact;
  }[];
  overallScore: number;
}

// Main ROI calculation interface
export interface IROICalculation extends Document {
  assessment: mongoose.Types.ObjectId;
  calculatedBy: mongoose.Types.ObjectId;
  status: 'draft' | 'final';
  categories: ICategoryMetrics[];
  overallROI: {
    totalAnnualSavings: number;
    totalImplementationCost: number;
    averagePaybackPeriod: number;
    overallFiveYearROI: number;
  };
  calculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MetricValueSchema = new Schema(
  {
    current: {
      type: Number,
      required: true,
    },
    target: {
      type: Number,
      required: true,
    },
    industry: {
      type: Number,
      required: true,
    },
    potential: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const FinancialImpactSchema = new Schema(
  {
    annualSavings: {
      type: Number,
      required: true,
    },
    implementationCost: {
      type: Number,
      required: true,
    },
    paybackPeriod: {
      type: Number,
      required: true,
    },
    fiveYearROI: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const MetricSchema = new Schema(
  {
    metricId: {
      type: String,
      required: true,
    },
    metricName: {
      type: String,
      required: true,
    },
    values: MetricValueSchema,
    financialImpact: FinancialImpactSchema,
  },
  { _id: false }
);

const CategoryMetricsSchema = new Schema(
  {
    categoryId: {
      type: String,
      required: true,
    },
    categoryName: {
      type: String,
      required: true,
    },
    metrics: [MetricSchema],
    overallScore: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const OverallROISchema = new Schema(
  {
    totalAnnualSavings: {
      type: Number,
      required: true,
    },
    totalImplementationCost: {
      type: Number,
      required: true,
    },
    averagePaybackPeriod: {
      type: Number,
      required: true,
    },
    overallFiveYearROI: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const ROICalculationSchema: Schema = new Schema(
  {
    assessment: {
      type: Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true,
    },
    calculatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'final'],
      default: 'draft',
    },
    categories: [CategoryMetricsSchema],
    overallROI: OverallROISchema,
    calculatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
ROICalculationSchema.index({ assessment: 1 });
ROICalculationSchema.index({ calculatedBy: 1 });
ROICalculationSchema.index({ status: 1 });
ROICalculationSchema.index({ calculatedAt: 1 });

// Delete the model if it exists to prevent OverwriteModelError
const ROICalculation: Model<IROICalculation> = mongoose.models.ROICalculation || mongoose.model<IROICalculation>('ROICalculation', ROICalculationSchema);

export default ROICalculation;
