import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for benchmark metric
interface IBenchmarkMetric {
  metricId: string;
  metricName: string;
  description: string;
  unit: string;
  values: {
    small: number;
    medium: number;
    large: number;
    enterprise: number;
  };
}

// Interface for benchmark category
interface IBenchmarkCategory {
  categoryId: string;
  categoryName: string;
  description: string;
  metrics: IBenchmarkMetric[];
}

// Main benchmark interface
export interface IBenchmark extends Document {
  industry: string;
  year: number;
  version: string;
  categories: IBenchmarkCategory[];
  source: string;
  lastUpdated: Date;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BenchmarkValueSchema = new Schema(
  {
    small: {
      type: Number,
      required: true,
    },
    medium: {
      type: Number,
      required: true,
    },
    large: {
      type: Number,
      required: true,
    },
    enterprise: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const BenchmarkMetricSchema = new Schema(
  {
    metricId: {
      type: String,
      required: true,
    },
    metricName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    unit: {
      type: String,
      required: true,
    },
    values: BenchmarkValueSchema,
  },
  { _id: false }
);

const BenchmarkCategorySchema = new Schema(
  {
    categoryId: {
      type: String,
      required: true,
    },
    categoryName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    metrics: [BenchmarkMetricSchema],
  },
  { _id: false }
);

const BenchmarkSchema: Schema = new Schema(
  {
    industry: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    version: {
      type: String,
      required: true,
    },
    categories: [BenchmarkCategorySchema],
    source: {
      type: String,
      required: true,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
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
BenchmarkSchema.index({ industry: 1 });
BenchmarkSchema.index({ year: 1 });
BenchmarkSchema.index({ isActive: 1 });

// Delete the model if it exists to prevent OverwriteModelError
const Benchmark: Model<IBenchmark> = mongoose.models.Benchmark || mongoose.model<IBenchmark>('Benchmark', BenchmarkSchema);

export default Benchmark;
