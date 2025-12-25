import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for chart data
interface IChartData {
  type: 'bar' | 'line' | 'pie' | 'radar' | 'comparison';
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string[];
    borderColor?: string[];
  }[];
}

// Interface for table data
interface ITableData {
  headers: string[];
  rows: (string | number)[][];
}

// Interface for report section content
interface IReportSectionContent {
  type: 'text' | 'chart' | 'table' | 'recommendation';
  text?: string;
  chartData?: IChartData;
  tableData?: ITableData;
  recommendationIds?: mongoose.Types.ObjectId[];
}

// Interface for report section
interface IReportSection {
  sectionId: string;
  title: string;
  order: number;
  content: IReportSectionContent;
}

// Main report interface
export interface IReport extends Document {
  name: string;
  assessment: mongoose.Types.ObjectId;
  template: mongoose.Types.ObjectId;
  company: mongoose.Types.ObjectId;
  warehouse: mongoose.Types.ObjectId;
  sections: IReportSection[];
  generatedBy: mongoose.Types.ObjectId;
  generatedAt: Date;
  lastModified?: Date;
  status: 'draft' | 'final';
  sharedWith: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const DatasetSchema = new Schema(
  {
    label: {
      type: String,
      required: true,
    },
    data: {
      type: [Number],
      required: true,
    },
    backgroundColor: {
      type: [String],
    },
    borderColor: {
      type: [String],
    },
  },
  { _id: false }
);

const ChartDataSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['bar', 'line', 'pie', 'radar', 'comparison'],
      required: true,
    },
    labels: {
      type: [String],
      required: true,
    },
    datasets: [DatasetSchema],
  },
  { _id: false }
);

const TableDataSchema = new Schema(
  {
    headers: {
      type: [String],
      required: true,
    },
    rows: {
      type: [[Schema.Types.Mixed]],
      required: true,
    },
  },
  { _id: false }
);

const ReportSectionContentSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['text', 'chart', 'table', 'recommendation'],
      required: true,
    },
    text: {
      type: String,
    },
    chartData: ChartDataSchema,
    tableData: TableDataSchema,
    recommendationIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Recommendation',
      },
    ],
  },
  { _id: false }
);

const ReportSectionSchema = new Schema(
  {
    sectionId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    order: {
      type: Number,
      required: true,
    },
    content: ReportSectionContentSchema,
  },
  { _id: false }
);

const ReportSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    assessment: {
      type: Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true,
    },
    template: {
      type: Schema.Types.ObjectId,
      ref: 'ReportTemplate',
      required: true,
    },
    company: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    warehouse: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
    },
    sections: [ReportSectionSchema],
    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    lastModified: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['draft', 'final'],
      default: 'draft',
    },
    sharedWith: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
ReportSchema.index({ assessment: 1 });
ReportSchema.index({ company: 1 });
ReportSchema.index({ warehouse: 1 });
ReportSchema.index({ generatedBy: 1 });
ReportSchema.index({ status: 1 });

// Delete the model if it exists to prevent OverwriteModelError
const Report: Model<IReport> = mongoose.models.Report || mongoose.model<IReport>('Report', ReportSchema);

export default Report;
