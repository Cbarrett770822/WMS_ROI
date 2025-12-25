import mongoose, { Schema, Document } from 'mongoose';

export interface ISetting extends Document {
  key: string;
  value: any;
  scope: 'system' | 'public' | 'user';
  userId?: mongoose.Types.ObjectId;
  description?: string;
  dataType: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  lastModifiedBy?: mongoose.Types.ObjectId;
  lastModifiedAt?: Date;
}

const SettingSchema: Schema = new Schema({
  key: {
    type: String,
    required: true,
    trim: true
  },
  value: {
    type: Schema.Types.Mixed,
    required: true
  },
  scope: {
    type: String,
    enum: ['system', 'public', 'user'],
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    default: null
  },
  description: {
    type: String,
    default: ''
  },
  dataType: {
    type: String,
    enum: ['string', 'number', 'boolean', 'object', 'array', 'date'],
    default: 'string'
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
  lastModifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModifiedAt: {
    type: Date
  }
}, {
  // This allows us to store the mixed type 'value' field
  minimize: false
});

// Create compound indexes for common query patterns
SettingSchema.index({ key: 1, scope: 1, userId: 1 }, { unique: true });

// Create model or use existing one
export default mongoose.models.Setting || mongoose.model<ISetting>('Setting', SettingSchema);
