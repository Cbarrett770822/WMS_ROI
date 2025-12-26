// Test script for ROI Calculator
// Run with: node test-calculator.js

const { calculateWMSROI } = require('./netlify/functions/utils/roiCalculator');

console.log('='.repeat(80));
console.log('WMS ROI CALCULATOR TEST');
console.log('='.repeat(80));

// Sample data based on Infor WMS Benefit Analysis example
const sampleAssessment = {
  // Business metrics
  annualRevenue: 100000000,      // $100M
  operatingMargin: 4.5,          // 4.5%
  
  // Manufacturing metrics
  mfgManagers: 15,               // 15 managers
  mfgManagerCost: 62500,         // $62,500 per manager
  shopFloorFTEs: 420,            // 420 shop floor employees
  shopFloorCost: 30000,          // $30,000 per employee
  annualWasteCost: 500000,       // $500,000 waste
  
  // Warehouse metrics
  warehouseManagers: 10,         // 10 managers
  warehouseManagerCost: 90000,   // $90,000 per manager
  warehouseEmployees: 400,       // 400 employees
  warehouseEmployeeCost: 30000,  // $30,000 per employee
  annualLogisticsCost: 2000000   // $2M logistics
};

console.log('\nINPUT DATA:');
console.log('-'.repeat(80));
console.log('Business Metrics:');
console.log(`  Annual Revenue: $${sampleAssessment.annualRevenue.toLocaleString()}`);
console.log(`  Operating Margin: ${sampleAssessment.operatingMargin}%`);

console.log('\nManufacturing Metrics:');
console.log(`  Managers: ${sampleAssessment.mfgManagers} @ $${sampleAssessment.mfgManagerCost.toLocaleString()}`);
console.log(`  Total Mfg Admin Cost: $${(sampleAssessment.mfgManagers * sampleAssessment.mfgManagerCost).toLocaleString()}`);
console.log(`  Shop Floor FTEs: ${sampleAssessment.shopFloorFTEs} @ $${sampleAssessment.shopFloorCost.toLocaleString()}`);
console.log(`  Total Workforce Cost: $${(sampleAssessment.shopFloorFTEs * sampleAssessment.shopFloorCost).toLocaleString()}`);
console.log(`  Annual Waste Cost: $${sampleAssessment.annualWasteCost.toLocaleString()}`);

console.log('\nWarehouse Metrics:');
console.log(`  Managers: ${sampleAssessment.warehouseManagers} @ $${sampleAssessment.warehouseManagerCost.toLocaleString()}`);
console.log(`  Total WH Admin Cost: $${(sampleAssessment.warehouseManagers * sampleAssessment.warehouseManagerCost).toLocaleString()}`);
console.log(`  Employees: ${sampleAssessment.warehouseEmployees} @ $${sampleAssessment.warehouseEmployeeCost.toLocaleString()}`);
console.log(`  Total WH Labour Cost: $${(sampleAssessment.warehouseEmployees * sampleAssessment.warehouseEmployeeCost).toLocaleString()}`);
console.log(`  Annual Logistics Cost: $${sampleAssessment.annualLogisticsCost.toLocaleString()}`);

// Calculate ROI
const results = calculateWMSROI(sampleAssessment);

console.log('\n' + '='.repeat(80));
console.log('ROI CALCULATION RESULTS');
console.log('='.repeat(80));

console.log('\nCONSERVATIVE ESTIMATE:');
console.log('-'.repeat(80));
console.log(`1. Mfg Admin Productivity (11%):        $${results.mfgAdminSavings.toLocaleString()}`);
console.log(`2. Workforce Productivity (11%):        $${results.workforceSavings.toLocaleString()}`);
console.log(`3. Capacity/Throughput (12%):           $${results.capacitySavings.toLocaleString()}`);
console.log(`4. Waste Reduction (13%):               $${results.wasteSavings.toLocaleString()}`);
console.log(`5. Warehouse Admin Productivity (11%):  $${results.warehouseAdminSavings.toLocaleString()}`);
console.log(`6. Direct Labour Costs (8.6%):          $${results.labourSavings.toLocaleString()}`);
console.log(`7. Transportation/Logistics (20%):      $${results.logisticsSavings.toLocaleString()}`);
console.log('-'.repeat(80));
console.log(`TOTAL ANNUAL SAVINGS:                   $${results.totalAnnualSavings.toLocaleString()}`);

console.log('\nLIKELY ESTIMATE:');
console.log('-'.repeat(80));
console.log(`1. Mfg Admin Productivity (14%):        $${results.likely.mfgAdminSavings.toLocaleString()}`);
console.log(`2. Workforce Productivity (14%):        $${results.likely.workforceSavings.toLocaleString()}`);
console.log(`3. Capacity/Throughput (38%):           $${results.likely.capacitySavings.toLocaleString()}`);
console.log(`4. Waste Reduction (16%):               $${results.likely.wasteSavings.toLocaleString()}`);
console.log(`5. Warehouse Admin Productivity (14%):  $${results.likely.warehouseAdminSavings.toLocaleString()}`);
console.log(`6. Direct Labour Costs (12.6%):         $${results.likely.labourSavings.toLocaleString()}`);
console.log(`7. Transportation/Logistics (40%):      $${results.likely.logisticsSavings.toLocaleString()}`);
console.log('-'.repeat(80));
console.log(`TOTAL ANNUAL SAVINGS:                   $${results.likely.totalAnnualSavings.toLocaleString()}`);

console.log('\nFINANCIAL METRICS:');
console.log('-'.repeat(80));
console.log(`Implementation Cost:                    $${results.implementationCost.toLocaleString()}`);
console.log('\nConservative Scenario:');
console.log(`  Payback Period:                       ${results.paybackPeriod} months`);
console.log(`  3-Year ROI:                           ${results.threeYearROI}%`);
console.log('\nLikely Scenario:');
console.log(`  Payback Period:                       ${results.likelyPaybackPeriod} months`);
console.log(`  3-Year ROI:                           ${results.likelyThreeYearROI}%`);

console.log('\n' + '='.repeat(80));
console.log('EXPECTED RESULTS (from Infor methodology):');
console.log('-'.repeat(80));
console.log('Conservative Total: ~$3,619,173');
console.log('Likely Total:       ~$6,120,850');
console.log('='.repeat(80));

// Verify calculations match expected values
const expectedConservative = 3619173;
const expectedLikely = 6120850;
const tolerance = 0.01; // 1% tolerance

const conservativeMatch = Math.abs(results.totalAnnualSavings - expectedConservative) / expectedConservative < tolerance;
const likelyMatch = Math.abs(results.likely.totalAnnualSavings - expectedLikely) / expectedLikely < tolerance;

console.log('\nVALIDATION:');
console.log('-'.repeat(80));
console.log(`Conservative estimate matches expected: ${conservativeMatch ? '✓ PASS' : '✗ FAIL'}`);
console.log(`  Expected: $${expectedConservative.toLocaleString()}`);
console.log(`  Actual:   $${results.totalAnnualSavings.toLocaleString()}`);
console.log(`  Diff:     $${(results.totalAnnualSavings - expectedConservative).toLocaleString()}`);

console.log(`\nLikely estimate matches expected: ${likelyMatch ? '✓ PASS' : '✗ FAIL'}`);
console.log(`  Expected: $${expectedLikely.toLocaleString()}`);
console.log(`  Actual:   $${results.likely.totalAnnualSavings.toLocaleString()}`);
console.log(`  Diff:     $${(results.likely.totalAnnualSavings - expectedLikely).toLocaleString()}`);

console.log('\n' + '='.repeat(80));
if (conservativeMatch && likelyMatch) {
  console.log('✓ ALL TESTS PASSED - Calculator is working correctly!');
} else {
  console.log('✗ TESTS FAILED - Calculator needs adjustment');
}
console.log('='.repeat(80) + '\n');
