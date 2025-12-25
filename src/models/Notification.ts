import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  sender?: mongoose.Types.ObjectId;
  type: string;
  title: string;
  message?: string;
  entityType?: string;
  entityId?: mongoose.Types.ObjectId;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema: Schema = new Schema({
  recipient: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    required: true,
    enum: [
      'info',
      'success',
      'warning',
      'error',
      'assignment',
      'completion',
      'mention',
      'update',
      'reminder',
      'system'
    ]
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String
  },
  entityType: {
    type: String,
    enum: [
      'user',
      'company',
      'warehouse',
      'assessment',
      'questionnaire',
      'roi',
      'recommendation',
      'report',
      'benchmark',
      'system'
    ]
  },
  entityId: {
    type: Schema.Types.ObjectId
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false // We'll use the createdAt field explicitly
});

// Create compound indexes for common query patterns
NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

// Create model or use existing one
export default mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);
