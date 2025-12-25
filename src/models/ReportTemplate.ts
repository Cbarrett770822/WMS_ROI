import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for report section template
interface IReportSectionTemplate {
  sectionId: string;
  title: string;
  description: string;
  order: number;
  contentType: 'text' | 'chart' | 'table' | 'recommendation';
  defaultContent?: string;
  chartType?: 'bar' | 'line' | 'pie' | 'radar' | 'comparison';
  dataSource?: {
    type: 'assessment' | 'roi' | 'benchmark' | 'recommendation';
    field: string;
  };
}

// Main report template interface
export interface IReportTemplate extends Document {
  name: string;
  description: string;
  type: 'assessment' | 'roi' | 'benchmark' | 'executive' | 'custom';
  sections: IReportSectionTemplate[];
  isDefault: boolean;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DataSourceSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['assessment', 'roi', 'benchmark', 'recommendation'],
      required: true,
    },
    field: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const ReportSectionTemplateSchema = new Schema(
  {
    sectionId: {
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
    order: {
      type: Number,
      required: true,
    },
    contentType: {
      type: String,
      enum: ['text', 'chart', 'table', 'recommendation'],
      required: true,
    },
    defaultContent: {
      type: String,
    },
    chartType: {
      type: String,
      enum: ['bar', 'line', 'pie', 'radar', 'comparison'],
    },
    dataSource: DataSourceSchema,
  },
  { _id: false }
);

const ReportTemplateSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['assessment', 'roi', 'benchmark', 'executive', 'custom'],
      required: true,
    },
    sections: [ReportSectionTemplateSchema],
    isDefault: {
      type: Boolean,
      default: false,
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
ReportTemplateSchema.index({ type: 1 });
ReportTemplateSchema.index({ isDefault: 1 });
ReportTemplateSchema.index({ isActive: 1 });

// Delete the model if it exists to prevent OverwriteModelError
const ReportTemplate: Model<IReportTemplate> = mongoose.models.ReportTemplate || mongoose.model<IReportTemplate>('ReportTemplate', ReportTemplateSchema);

export default ReportTemplate;
