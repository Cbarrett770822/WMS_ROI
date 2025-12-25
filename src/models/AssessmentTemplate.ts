import mongoose, { Schema, Document } from 'mongoose';

// Define interfaces for nested objects
interface IQuestion {
  id: string;
  text: string;
  type: string;
  required: boolean;
  options?: Array<{
    value: string;
    label: string;
  }>;
  validations?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  defaultValue?: any;
  helpText?: string;
}

interface ISubsection {
  id: string;
  title: string;
  description?: string;
  questions: IQuestion[];
}

interface ISection {
  id: string;
  title: string;
  description?: string;
  order: number;
  subsections: ISubsection[];
}

// Define the main document interface
export interface IAssessmentTemplate extends Document {
  name: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
  version: string;
  sections: ISection[];
  targetIndustries: string[];
  targetWarehouseTypes: string[];
  targetCompanySizes: string[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedBy: mongoose.Types.ObjectId;
  updatedAt: Date;
  publishedAt?: Date;
}

// Define schemas for nested objects
const QuestionSchema = new Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  type: { 
    type: String, 
    required: true,
    enum: ['text', 'textarea', 'number', 'select', 'multiselect', 'radio', 'checkbox', 'date', 'file', 'scale']
  },
  required: { type: Boolean, default: false },
  options: [{
    value: String,
    label: String
  }],
  validations: {
    min: Number,
    max: Number,
    pattern: String
  },
  defaultValue: Schema.Types.Mixed,
  helpText: String
}, { _id: false });

const SubsectionSchema = new Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  questions: [QuestionSchema]
}, { _id: false });

const SectionSchema = new Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  order: { type: Number, required: true },
  subsections: [SubsectionSchema]
}, { _id: false });

// Define the main schema
const AssessmentTemplateSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
    index: true
  },
  version: {
    type: String,
    default: '1.0'
  },
  sections: {
    type: [SectionSchema],
    default: []
  },
  targetIndustries: {
    type: [String],
    default: [],
    index: true
  },
  targetWarehouseTypes: {
    type: [String],
    default: [],
    index: true
  },
  targetCompanySizes: {
    type: [String],
    default: [],
    index: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  publishedAt: {
    type: Date
  }
});

// Create indexes for common query patterns
AssessmentTemplateSchema.index({ status: 1, targetIndustries: 1 });
AssessmentTemplateSchema.index({ status: 1, targetWarehouseTypes: 1 });
AssessmentTemplateSchema.index({ status: 1, targetCompanySizes: 1 });
AssessmentTemplateSchema.index({ createdAt: -1 });

// Create model or use existing one
export default mongoose.models.AssessmentTemplate || 
  mongoose.model<IAssessmentTemplate>('AssessmentTemplate', AssessmentTemplateSchema);
