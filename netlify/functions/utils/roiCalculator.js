// WMS ROI Calculation Engine
// Based on industry benchmarks and best practices

function calculateWMSROI(assessmentData) {
  const {
    annualRevenue,
    warehouseSquareFeet,
    numberOfEmployees,
    dailyOrderVolume,
    currentPickAccuracy,
    averagePickTime,
    inventoryTurnover,
    spaceUtilization,
    laborCostPercentage,
    overtimePercentage
  } = assessmentData;

  // Industry benchmarks
  const BENCHMARKS = {
    targetPickAccuracy: 99.5,
    targetPickTime: 45, // seconds per pick
    targetSpaceUtilization: 85,
    targetInventoryTurnover: 8,
    targetOvertimePercentage: 5,
    avgLaborCostPerEmployee: 45000,
    avgCostPerSquareFoot: 8
  };

  // Calculate annual labor cost
  const annualLaborCost = numberOfEmployees * BENCHMARKS.avgLaborCostPerEmployee;
  const laborCostFromRevenue = annualRevenue * (laborCostPercentage / 100);
  const totalLaborCost = Math.max(annualLaborCost, laborCostFromRevenue);

  // 1. LABOR EFFICIENCY SAVINGS
  const currentPicksPerHour = 3600 / averagePickTime;
  const targetPicksPerHour = 3600 / BENCHMARKS.targetPickTime;
  const productivityImprovement = ((targetPicksPerHour - currentPicksPerHour) / currentPicksPerHour) * 100;
  const laborSavings = totalLaborCost * (productivityImprovement / 100) * 0.7; // 70% realization

  // 2. OVERTIME REDUCTION
  const overtimeReduction = Math.max(0, overtimePercentage - BENCHMARKS.targetOvertimePercentage);
  const overtimeSavings = totalLaborCost * (overtimeReduction / 100) * 0.5; // OT premium

  // 3. SPACE OPTIMIZATION SAVINGS
  const spaceImprovement = Math.max(0, BENCHMARKS.targetSpaceUtilization - spaceUtilization);
  const potentialSpaceReclaimed = warehouseSquareFeet * (spaceImprovement / 100);
  const spaceSavings = potentialSpaceReclaimed * BENCHMARKS.avgCostPerSquareFoot;

  // 4. ACCURACY IMPROVEMENT SAVINGS
  const accuracyGap = Math.max(0, BENCHMARKS.targetPickAccuracy - currentPickAccuracy);
  const errorReduction = accuracyGap / 100;
  const annualOrders = dailyOrderVolume * 250; // 250 working days
  const avgCostPerError = 25; // Industry average
  const accuracySavings = annualOrders * errorReduction * avgCostPerError;

  // 5. INVENTORY OPTIMIZATION SAVINGS
  const inventoryGap = Math.max(0, BENCHMARKS.targetInventoryTurnover - inventoryTurnover);
  const avgInventoryValue = annualRevenue * 0.25; // Typical inventory as % of revenue
  const carryingCostRate = 0.25; // 25% annual carrying cost
  const inventorySavings = (avgInventoryValue / inventoryTurnover) * (inventoryGap / BENCHMARKS.targetInventoryTurnover) * carryingCostRate;

  // 6. THROUGHPUT IMPROVEMENT
  const throughputGain = productivityImprovement > 0 ? (dailyOrderVolume * (productivityImprovement / 100)) : 0;
  const revenuePerOrder = annualRevenue / (dailyOrderVolume * 250);
  const throughputRevenue = throughputGain * 250 * revenuePerOrder * 0.3; // 30% margin

  // TOTAL ANNUAL SAVINGS
  const totalAnnualSavings = 
    laborSavings + 
    overtimeSavings + 
    spaceSavings + 
    accuracySavings + 
    inventorySavings + 
    throughputRevenue;

  // IMPLEMENTATION COST ESTIMATION
  // Based on total employees and revenue
  const totalEmployees = (mfgManagers || 0) + (shopFloorFTEs || 0) + (warehouseManagers || 0) + (warehouseEmployees || 0);
  const baseImplementationCost = 75000;
  const employeeMultiplier = Math.max(1, totalEmployees / 100);
  const revenueMultiplier = Math.max(1, (annualRevenue || 0) / 50000000);
  const implementationCost = baseImplementationCost * employeeMultiplier * revenueMultiplier;

  // PAYBACK PERIOD (in months) - using conservative estimate
  const paybackPeriod = totalAnnualSavings > 0 ? (implementationCost / totalAnnualSavings) * 12 : 0;

  // 3-YEAR ROI - using conservative estimate
  const threeYearSavings = totalAnnualSavings * 3;
  const threeYearROI = implementationCost > 0 ? ((threeYearSavings - implementationCost) / implementationCost) * 100 : 0;

  return {
    // Conservative Estimate (Primary)
    mfgAdminSavings: estimates.conservative.mfgAdminSavings,
    workforceSavings: estimates.conservative.workforceSavings,
    capacitySavings: estimates.conservative.capacitySavings,
    wasteSavings: estimates.conservative.wasteSavings,
    warehouseAdminSavings: estimates.conservative.warehouseAdminSavings,
    labourSavings: estimates.conservative.labourSavings,
    logisticsSavings: estimates.conservative.logisticsSavings,
    totalAnnualSavings: estimates.conservative.totalAnnualSavings,
    
    // Likely Estimate (Optimistic)
    likely: {
      mfgAdminSavings: estimates.likely.mfgAdminSavings,
      workforceSavings: estimates.likely.workforceSavings,
      capacitySavings: estimates.likely.capacitySavings,
      wasteSavings: estimates.likely.wasteSavings,
      warehouseAdminSavings: estimates.likely.warehouseAdminSavings,
      labourSavings: estimates.likely.labourSavings,
      logisticsSavings: estimates.likely.logisticsSavings,
      totalAnnualSavings: estimates.likely.totalAnnualSavings
    },
    
    // Financial Metrics
    implementationCost: Math.round(implementationCost),
    paybackPeriod: Math.round(paybackPeriod * 10) / 10,
    threeYearROI: Math.round(threeYearROI * 10) / 10,
    
    // Likely scenario financial metrics
    likelyPaybackPeriod: estimates.likely.totalAnnualSavings > 0 ? 
      Math.round((implementationCost / estimates.likely.totalAnnualSavings) * 12 * 10) / 10 : 0,
    likelyThreeYearROI: implementationCost > 0 ? 
      Math.round((((estimates.likely.totalAnnualSavings * 3) - implementationCost) / implementationCost) * 100 * 10) / 10 : 0
  };
}

module.exports = { calculateWMSROI };
