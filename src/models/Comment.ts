import mongoose, { Schema, Document } from 'mongoose';

export interface IComment extends Document {
  assessment: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  content: string;
  section?: string;
  mentions?: string[];
  createdAt: Date;
  updatedAt?: Date;
}

const CommentSchema: Schema = new Schema({
  assessment: {
    type: Schema.Types.ObjectId,
    ref: 'Assessment',
    required: true,
    index: true
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  section: {
    type: String,
    // Sections could be: general, questionnaire, roi, recommendations, etc.
    enum: [
      'general',
      'questionnaire',
      'roi',
      'recommendations',
      'implementation',
      'report'
    ],
    default: 'general'
  },
  mentions: [{
    type: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date
  }
});

// Create indexes for common query patterns
CommentSchema.index({ assessment: 1, createdAt: -1 });
CommentSchema.index({ author: 1, createdAt: -1 });
CommentSchema.index({ mentions: 1 });

// Create model or use existing one
export default mongoose.models.Comment || mongoose.model<IComment>('Comment', CommentSchema);
