import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWarehouse extends Document {
  name: string;
  company: mongoose.Types.ObjectId;
  type: 'distribution' | 'fulfillment' | 'manufacturing' | 'cold_storage' | 'cross_dock' | 'other';
  size: number; // Size in square feet
  location: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  ownership: 'owned' | 'leased' | 'third_party';
  yearBuilt?: number;
  lastRenovation?: number;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseSchema: Schema = new Schema(
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
    type: {
      type: String,
      enum: ['distribution', 'fulfillment', 'manufacturing', 'cold_storage', 'cross_dock', 'other'],
      required: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    location: {
      address: {
        type: String,
        required: true,
        trim: true,
      },
      city: {
        type: String,
        required: true,
        trim: true,
      },
      state: {
        type: String,
        required: true,
        trim: true,
      },
      zipCode: {
        type: String,
        required: true,
        trim: true,
      },
      country: {
        type: String,
        required: true,
        trim: true,
      },
      coordinates: {
        latitude: {
          type: Number,
        },
        longitude: {
          type: Number,
        },
      },
    },
    ownership: {
      type: String,
      enum: ['owned', 'leased', 'third_party'],
      required: true,
    },
    yearBuilt: {
      type: Number,
    },
    lastRenovation: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
WarehouseSchema.index({ company: 1 });
WarehouseSchema.index({ type: 1 });
WarehouseSchema.index({ 'location.city': 1, 'location.state': 1 });

// Delete the model if it exists to prevent OverwriteModelError
const Warehouse: Model<IWarehouse> = mongoose.models.Warehouse || mongoose.model<IWarehouse>('Warehouse', WarehouseSchema);

export default Warehouse;
