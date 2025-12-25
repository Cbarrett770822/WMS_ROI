import mongoose, { Schema, Document } from 'mongoose';

export interface IRole extends Document {
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  createdBy: mongoose.Types.ObjectId;
  updatedAt?: Date;
  updatedBy?: mongoose.Types.ObjectId;
}

const RoleSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  permissions: [{
    type: String,
    required: true
  }],
  isSystem: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedAt: {
    type: Date
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
});

// Create indexes
RoleSchema.index({ name: 1 }, { unique: true });

// Create model or use existing one
export default mongoose.models.Role || mongoose.model<IRole>('Role', RoleSchema);
