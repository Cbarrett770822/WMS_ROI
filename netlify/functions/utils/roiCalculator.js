// WMS ROI Calculation Engine
// Based on Infor WMS Benefit Analysis Methodology
// Implements 7-category benefit calculation with Conservative and Likely estimates

function calculateWMSROI(assessmentData) {
  // Extract all input data with defaults
  const {
    // Business metrics
    annualRevenue = 0,
    operatingMargin = 0,
    
    // Manufacturing metrics
    mfgManagers = 0,
    mfgManagerCost = 0,
    shopFloorFTEs = 0,
    shopFloorCost = 0,
    annualWasteCost = 0,
    
    // Warehouse metrics
    warehouseManagers = 0,
    warehouseManagerCost = 0,
    warehouseEmployees = 0,
    warehouseEmployeeCost = 0,
    annualLogisticsCost = 0,
    
    // Legacy fields (for backward compatibility)
    warehouseSquareFeet = 0,
    numberOfEmployees = 0,
    dailyOrderVolume = 0,
    currentPickAccuracy = 0,
    averagePickTime = 0,
    inventoryTurnover = 0,
    spaceUtilization = 0,
    laborCostPercentage = 0,
    overtimePercentage = 0
  } = assessmentData;

  // Infor WMS Benchmark Percentages
  const BENCHMARKS = {
    // Manufacturing Admin Productivity
    mfgAdminConservative: 0.11,    // 11%
    mfgAdminLikely: 0.14,          // 14%
    
    // Workforce Productivity
    workforceConservative: 0.11,   // 11%
    workforceLikely: 0.14,         // 14%
    
    // Capacity & Throughput
    capacityConservative: 0.12,    // 12%
    capacityLikely: 0.38,          // 38%
    
    // Waste Reduction
    wasteConservative: 0.13,       // 13%
    wasteLikely: 0.16,             // 16%
    
    // Warehouse Admin Productivity
    whAdminConservative: 0.11,     // 11%
    whAdminLikely: 0.14,           // 14%
    
    // Direct Labour Costs
    labourConservative: 0.086,     // 8.6%
    labourLikely: 0.126,           // 12.6%
    
    // Transportation & Logistics
    logisticsConservative: 0.20,   // 20%
    logisticsLikely: 0.40          // 40%
  };

  // ============================================
  // CALCULATE CONSERVATIVE ESTIMATES
  // ============================================
  
  // 1. Manufacturing Admin Productivity (Conservative)
  const mfgTotalCost = mfgManagers * mfgManagerCost;
  const mfgAdminSavingsConservative = Math.round(mfgTotalCost * BENCHMARKS.mfgAdminConservative);
  
  // 2. Workforce Productivity (Conservative)
  const shopFloorTotalCost = shopFloorFTEs * shopFloorCost;
  const workforceSavingsConservative = Math.round(shopFloorTotalCost * BENCHMARKS.workforceConservative);
  
  // 3. Capacity & Throughput (Conservative)
  const marginDecimal = operatingMargin / 100;
  const capacitySavingsConservative = Math.round(annualRevenue * marginDecimal * BENCHMARKS.capacityConservative);
  
  // 4. Waste Reduction (Conservative)
  const wasteSavingsConservative = Math.round(annualWasteCost * BENCHMARKS.wasteConservative);
  
  // 5. Warehouse Admin Productivity (Conservative)
  const whMgrTotalCost = warehouseManagers * warehouseManagerCost;
  const warehouseAdminSavingsConservative = Math.round(whMgrTotalCost * BENCHMARKS.whAdminConservative);
  
  // 6. Direct Labour Costs (Conservative)
  const whEmpTotalCost = warehouseEmployees * warehouseEmployeeCost;
  const labourSavingsConservative = Math.round(whEmpTotalCost * BENCHMARKS.labourConservative);
  
  // 7. Transportation & Logistics (Conservative)
  const logisticsSavingsConservative = Math.round(annualLogisticsCost * BENCHMARKS.logisticsConservative);
  
  // Total Conservative Savings
  const totalAnnualSavingsConservative = 
    mfgAdminSavingsConservative +
    workforceSavingsConservative +
    capacitySavingsConservative +
    wasteSavingsConservative +
    warehouseAdminSavingsConservative +
    labourSavingsConservative +
    logisticsSavingsConservative;

  // ============================================
  // CALCULATE LIKELY ESTIMATES
  // ============================================
  
  // 1. Manufacturing Admin Productivity (Likely)
  const mfgAdminSavingsLikely = Math.round(mfgTotalCost * BENCHMARKS.mfgAdminLikely);
  
  // 2. Workforce Productivity (Likely)
  const workforceSavingsLikely = Math.round(shopFloorTotalCost * BENCHMARKS.workforceLikely);
  
  // 3. Capacity & Throughput (Likely)
  const capacitySavingsLikely = Math.round(annualRevenue * marginDecimal * BENCHMARKS.capacityLikely);
  
  // 4. Waste Reduction (Likely)
  const wasteSavingsLikely = Math.round(annualWasteCost * BENCHMARKS.wasteLikely);
  
  // 5. Warehouse Admin Productivity (Likely)
  const warehouseAdminSavingsLikely = Math.round(whMgrTotalCost * BENCHMARKS.whAdminLikely);
  
  // 6. Direct Labour Costs (Likely)
  const labourSavingsLikely = Math.round(whEmpTotalCost * BENCHMARKS.labourLikely);
  
  // 7. Transportation & Logistics (Likely)
  const logisticsSavingsLikely = Math.round(annualLogisticsCost * BENCHMARKS.logisticsLikely);
  
  // Total Likely Savings
  const totalAnnualSavingsLikely = 
    mfgAdminSavingsLikely +
    workforceSavingsLikely +
    capacitySavingsLikely +
    wasteSavingsLikely +
    warehouseAdminSavingsLikely +
    labourSavingsLikely +
    logisticsSavingsLikely;

  // ============================================
  // IMPLEMENTATION COST ESTIMATION
  // ============================================
  
  const totalEmployees = mfgManagers + shopFloorFTEs + warehouseManagers + warehouseEmployees;
  const baseImplementationCost = 75000;
  const employeeMultiplier = Math.max(1, totalEmployees / 100);
  const revenueMultiplier = Math.max(1, annualRevenue / 50000000);
  const implementationCost = Math.round(baseImplementationCost * employeeMultiplier * revenueMultiplier);

  // ============================================
  // FINANCIAL METRICS (Conservative)
  // ============================================
  
  const paybackPeriod = totalAnnualSavingsConservative > 0 ? 
    Math.round((implementationCost / totalAnnualSavingsConservative) * 12 * 10) / 10 : 0;
  
  const threeYearSavingsConservative = totalAnnualSavingsConservative * 3;
  const threeYearROI = implementationCost > 0 ? 
    Math.round(((threeYearSavingsConservative - implementationCost) / implementationCost) * 100 * 10) / 10 : 0;

  // ============================================
  // FINANCIAL METRICS (Likely)
  // ============================================
  
  const likelyPaybackPeriod = totalAnnualSavingsLikely > 0 ? 
    Math.round((implementationCost / totalAnnualSavingsLikely) * 12 * 10) / 10 : 0;
  
  const threeYearSavingsLikely = totalAnnualSavingsLikely * 3;
  const likelyThreeYearROI = implementationCost > 0 ? 
    Math.round(((threeYearSavingsLikely - implementationCost) / implementationCost) * 100 * 10) / 10 : 0;

  // ============================================
  // RETURN RESULTS
  // ============================================
  
  return {
    // Conservative Estimate (Primary)
    mfgAdminSavings: mfgAdminSavingsConservative,
    workforceSavings: workforceSavingsConservative,
    capacitySavings: capacitySavingsConservative,
    wasteSavings: wasteSavingsConservative,
    warehouseAdminSavings: warehouseAdminSavingsConservative,
    labourSavings: labourSavingsConservative,
    logisticsSavings: logisticsSavingsConservative,
    totalAnnualSavings: totalAnnualSavingsConservative,
    
    // Likely Estimate (Optimistic)
    likely: {
      mfgAdminSavings: mfgAdminSavingsLikely,
      workforceSavings: workforceSavingsLikely,
      capacitySavings: capacitySavingsLikely,
      wasteSavings: wasteSavingsLikely,
      warehouseAdminSavings: warehouseAdminSavingsLikely,
      labourSavings: labourSavingsLikely,
      logisticsSavings: logisticsSavingsLikely,
      totalAnnualSavings: totalAnnualSavingsLikely
    },
    
    // Financial Metrics (Conservative)
    implementationCost: implementationCost,
    paybackPeriod: paybackPeriod,
    threeYearROI: threeYearROI,
    
    // Financial Metrics (Likely)
    likelyPaybackPeriod: likelyPaybackPeriod,
    likelyThreeYearROI: likelyThreeYearROI
  };
}

module.exports = { calculateWMSROI };
