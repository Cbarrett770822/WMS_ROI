const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  contactEmail: {
    type: String,
    required: false,
    trim: true,
    lowercase: true
  },
  
  // Business Overview
  annualRevenue: {
    type: Number,
    required: false
  },
  operatingMargin: {
    type: Number,
    required: false
  },
  
  // ROI Form Fields
  mfgManagers: Number,
  mfgManagerCost: Number,
  shopFloorFTEs: Number,
  shopFloorCost: Number,
  annualWasteCost: Number,
  warehouseManagers: Number,
  warehouseManagerCost: Number,
  warehouseEmployees: Number,
  warehouseEmployeeCost: Number,
  annualLogisticsCost: Number,
  
  // Old Questionnaire Fields (optional for backward compatibility)
  warehouseSquareFeet: Number,
  numberOfEmployees: Number,
  dailyOrderVolume: Number,
  currentPickAccuracy: Number,
  averagePickTime: Number,
  inventoryTurnover: Number,
  spaceUtilization: Number,
  laborCostPercentage: Number,
  overtimePercentage: Number,
  
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
