import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAssessment extends Document {
  name: string;
  company: mongoose.Types.ObjectId;
  warehouse: mongoose.Types.ObjectId;
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  startDate: Date;
  completionDate?: Date;
  createdBy: mongoose.Types.ObjectId;
  assignedTo: mongoose.Types.ObjectId[];
  currentStage: number;
  totalStages: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
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
    status: {
      type: String,
      enum: ['draft', 'in_progress', 'completed', 'archived'],
      default: 'draft',
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    completionDate: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedTo: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    currentStage: {
      type: Number,
      default: 1,
    },
    totalStages: {
      type: Number,
      default: 5,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
AssessmentSchema.index({ company: 1 });
AssessmentSchema.index({ warehouse: 1 });
AssessmentSchema.index({ status: 1 });
AssessmentSchema.index({ createdBy: 1 });
AssessmentSchema.index({ assignedTo: 1 });

// Delete the model if it exists to prevent OverwriteModelError
const Assessment: Model<IAssessment> = mongoose.models.Assessment || mongoose.model<IAssessment>('Assessment', AssessmentSchema);

export default Assessment;
