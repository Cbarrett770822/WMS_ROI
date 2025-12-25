import mongoose, { Schema, Document } from 'mongoose';

export interface ITemplate extends Document {
  name: string;
  description?: string;
  type: string; // 'report', 'assessment', etc.
  content: any; // JSON structure for template content
  isPublic: boolean;
  isSystem: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: mongoose.Types.ObjectId;
}

const TemplateSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['report', 'assessment', 'questionnaire', 'chart'],
    default: 'report'
  },
  content: {
    type: Schema.Types.Mixed,
    required: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  isSystem: {
    type: Boolean,
    default: false
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
  updatedAt: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
});

// Create indexes for better query performance
TemplateSchema.index({ name: 1 });
TemplateSchema.index({ type: 1 });
TemplateSchema.index({ createdBy: 1 });
TemplateSchema.index({ isPublic: 1 });

export default mongoose.models.Template || mongoose.model<ITemplate>('Template', TemplateSchema);
