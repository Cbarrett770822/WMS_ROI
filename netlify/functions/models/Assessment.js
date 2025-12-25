const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  contactEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  
  // Business Overview
  annualRevenue: {
    type: Number,
    required: true
  },
  warehouseSquareFeet: {
    type: Number,
    required: true
  },
  numberOfEmployees: {
    type: Number,
    required: true
  },
  dailyOrderVolume: {
    type: Number,
    required: true
  },
  
  // Warehouse Operations
  currentPickAccuracy: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  averagePickTime: {
    type: Number,
    required: true
  },
  inventoryTurnover: {
    type: Number,
    required: true
  },
  spaceUtilization: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  laborCostPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  overtimePercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  
  // Pain Points
  primaryChallenges: {
    type: [String],
    required: true
  },
  technologyGaps: {
    type: String,
    required: true
  },
  
  // ROI Calculations (stored after calculation)
  roiResults: {
    // Conservative Estimates (Primary)
    mfgAdminSavings: Number,
    workforceSavings: Number,
    capacitySavings: Number,
    wasteSavings: Number,
    warehouseAdminSavings: Number,
    labourSavings: Number,
    logisticsSavings: Number,
    totalAnnualSavings: Number,
    
    // Likely Estimates (Optimistic)
    likely: {
      mfgAdminSavings: Number,
      workforceSavings: Number,
      capacitySavings: Number,
      wasteSavings: Number,
      warehouseAdminSavings: Number,
      labourSavings: Number,
      logisticsSavings: Number,
      totalAnnualSavings: Number
    },
    
    // Financial Metrics
    implementationCost: Number,
    paybackPeriod: Number,
    threeYearROI: Number,
    likelyPaybackPeriod: Number,
    likelyThreeYearROI: Number
  },
  
  status: {
    type: String,
    enum: ['draft', 'completed'],
    default: 'draft'
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

assessmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.models.Assessment || mongoose.model('Assessment', assessmentSchema);
