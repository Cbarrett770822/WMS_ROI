import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for implementation step
interface IImplementationStep {
  stepNumber: number;
  description: string;
  estimatedTimeframe: string;
  resources: string[];
}

// Main recommendation interface
export interface IRecommendation extends Document {
  assessment: mongoose.Types.ObjectId;
  roiCalculation: mongoose.Types.ObjectId;
  category: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  impact: {
    operational: number; // 1-10 scale
    financial: number; // 1-10 scale
    strategic: number; // 1-10 scale
  };
  estimatedCost: {
    min: number;
    max: number;
    currency: string;
  };
  estimatedTimeToImplement: {
    value: number;
    unit: 'days' | 'weeks' | 'months';
  };
  implementationSteps: IImplementationStep[];
  potentialChallenges: string[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ImplementationStepSchema = new Schema(
  {
    stepNumber: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    estimatedTimeframe: {
      type: String,
      required: true,
    },
    resources: [String],
  },
  { _id: false }
);

const ImpactSchema = new Schema(
  {
    operational: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    financial: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    strategic: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
  },
  { _id: false }
);

const EstimatedCostSchema = new Schema(
  {
    min: {
      type: Number,
      required: true,
    },
    max: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'USD',
    },
  },
  { _id: false }
);

const EstimatedTimeSchema = new Schema(
  {
    value: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      enum: ['days', 'weeks', 'months'],
      required: true,
    },
  },
  { _id: false }
);

const RecommendationSchema: Schema = new Schema(
  {
    assessment: {
      type: Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true,
    },
    roiCalculation: {
      type: Schema.Types.ObjectId,
      ref: 'ROICalculation',
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      required: true,
    },
    impact: ImpactSchema,
    estimatedCost: EstimatedCostSchema,
    estimatedTimeToImplement: EstimatedTimeSchema,
    implementationSteps: [ImplementationStepSchema],
    potentialChallenges: [String],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
RecommendationSchema.index({ assessment: 1 });
RecommendationSchema.index({ roiCalculation: 1 });
RecommendationSchema.index({ priority: 1 });
RecommendationSchema.index({ category: 1 });

// Delete the model if it exists to prevent OverwriteModelError
const Recommendation: Model<IRecommendation> = mongoose.models.Recommendation || mongoose.model<IRecommendation>('Recommendation', RecommendationSchema);

export default Recommendation;
