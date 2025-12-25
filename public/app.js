// Excel-Style ROI Calculator
// Matches the Infor WMS Benefit Analysis Excel structure

// Update calculated fields in real-time
document.addEventListener('DOMContentLoaded', function() {
    // Add input listeners for real-time calculation updates
    const inputs = document.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        input.addEventListener('input', updateCalculatedFields);
    });
    
    // Initial calculation
    updateCalculatedFields();
});

function updateCalculatedFields() {
    // Manufacturing Admin
    const mfgManagers = parseFloat(document.getElementById('mfgManagers').value) || 0;
    const mfgManagerCost = parseFloat(document.getElementById('mfgManagerCost').value) || 0;
    const mfgTotal = mfgManagers * mfgManagerCost;
    document.getElementById('mfgTotalCost').textContent = formatCurrency(mfgTotal);
    document.getElementById('mfgTotalCost2').textContent = formatCurrency(mfgTotal);
    document.getElementById('mfgAdminBenefit1').textContent = formatCurrency(mfgTotal * 0.11);
    document.getElementById('mfgAdminBenefit2').textContent = formatCurrency(mfgTotal * 0.14);
    
    
    // Capacity & Throughput
    const annualRevenue = parseFloat(document.getElementById('annualRevenue').value) || 0;
    const operatingMargin = parseFloat(document.getElementById('operatingMargin').value) || 0;
    const marginDecimal = operatingMargin / 100;
    document.getElementById('capacityBenefit1').textContent = formatCurrency(annualRevenue * marginDecimal * 0.12);
    document.getElementById('capacityBenefit2').textContent = formatCurrency(annualRevenue * marginDecimal * 0.38);
    
    // Waste Reduction
    const annualWasteCost = parseFloat(document.getElementById('annualWasteCost').value) || 0;
    document.getElementById('wasteBenefit1').textContent = formatCurrency(annualWasteCost * 0.13);
    document.getElementById('wasteBenefit2').textContent = formatCurrency(annualWasteCost * 0.16);
    
    // Warehouse Admin
    const warehouseManagers = parseFloat(document.getElementById('warehouseManagers').value) || 0;
    const warehouseManagerCost = parseFloat(document.getElementById('warehouseManagerCost').value) || 0;
    const whMgrTotal = warehouseManagers * warehouseManagerCost;
    document.getElementById('whMgrTotal').textContent = formatCurrency(whMgrTotal);
    document.getElementById('whMgrTotal2').textContent = formatCurrency(whMgrTotal);
    document.getElementById('whAdminBenefit1').textContent = formatCurrency(whMgrTotal * 0.11);
    document.getElementById('whAdminBenefit2').textContent = formatCurrency(whMgrTotal * 0.14);
    
    // Direct Labour
    const warehouseEmployees = parseFloat(document.getElementById('warehouseEmployees').value) || 0;
    const warehouseEmployeeCost = parseFloat(document.getElementById('warehouseEmployeeCost').value) || 0;
    const whEmpTotal = warehouseEmployees * warehouseEmployeeCost;
    document.getElementById('whEmpTotal').textContent = formatCurrency(whEmpTotal);
    document.getElementById('whEmpTotal2').textContent = formatCurrency(whEmpTotal);
    document.getElementById('labourBenefit1').textContent = formatCurrency(whEmpTotal * 0.086);
    document.getElementById('labourBenefit2').textContent = formatCurrency(whEmpTotal * 0.126);
    
    // Logistics
    const annualLogisticsCost = parseFloat(document.getElementById('annualLogisticsCost').value) || 0;
    document.getElementById('logisticsBenefit1').textContent = formatCurrency(annualLogisticsCost * 0.20);
    document.getElementById('logisticsBenefit2').textContent = formatCurrency(annualLogisticsCost * 0.40);
}

function calculateROI() {
    // Get company information
    const companyName = document.getElementById('companyName').value.trim();
    const contactEmail = document.getElementById('contactEmail').value.trim();
    
    // Validate company information
    if (!companyName || !contactEmail) {
        showError('Please enter Company Name and Contact Email');
        return;
    }
    
    // Get all values
    const mfgManagers = parseFloat(document.getElementById('mfgManagers').value) || 0;
    const mfgManagerCost = parseFloat(document.getElementById('mfgManagerCost').value) || 0;
    const shopFloorFTEs = 0;
    const shopFloorCost = 0;
    const annualRevenue = parseFloat(document.getElementById('annualRevenue').value) || 0;
    const operatingMargin = parseFloat(document.getElementById('operatingMargin').value) || 0;
    const annualWasteCost = parseFloat(document.getElementById('annualWasteCost').value) || 0;
    const warehouseManagers = parseFloat(document.getElementById('warehouseManagers').value) || 0;
    const warehouseManagerCost = parseFloat(document.getElementById('warehouseManagerCost').value) || 0;
    const warehouseEmployees = parseFloat(document.getElementById('warehouseEmployees').value) || 0;
    const warehouseEmployeeCost = parseFloat(document.getElementById('warehouseEmployeeCost').value) || 0;
    const annualLogisticsCost = parseFloat(document.getElementById('annualLogisticsCost').value) || 0;
    
    // Calculate benefits
    const mfgTotal = mfgManagers * mfgManagerCost;
    const mfgAdminCons = mfgTotal * 0.11;
    const mfgAdminLikely = mfgTotal * 0.14;
    
    const shopFloorTotal = shopFloorFTEs * shopFloorCost;
    const workforceCons = shopFloorTotal * 0.11;
    const workforceLikely = shopFloorTotal * 0.14;
    
    const marginDecimal = operatingMargin / 100;
    const capacityCons = annualRevenue * marginDecimal * 0.12;
    const capacityLikely = annualRevenue * marginDecimal * 0.38;
    
    const wasteCons = annualWasteCost * 0.13;
    const wasteLikely = annualWasteCost * 0.16;
    
    const whMgrTotal = warehouseManagers * warehouseManagerCost;
    const whAdminCons = whMgrTotal * 0.11;
    const whAdminLikely = whMgrTotal * 0.14;
    
    const whEmpTotal = warehouseEmployees * warehouseEmployeeCost;
    const labourCons = whEmpTotal * 0.086;
    const labourLikely = whEmpTotal * 0.126;
    
    const logisticsCons = annualLogisticsCost * 0.20;
    const logisticsLikely = annualLogisticsCost * 0.40;
    
    // Calculate totals
    const totalConservative = mfgAdminCons + workforceCons + capacityCons + wasteCons + whAdminCons + labourCons + logisticsCons;
    const totalLikely = mfgAdminLikely + workforceLikely + capacityLikely + wasteLikely + whAdminLikely + labourLikely + logisticsLikely;
    
    // Display results
    document.getElementById('totalConservative').textContent = formatCurrency(totalConservative);
    document.getElementById('totalLikely').textContent = formatCurrency(totalLikely);
    
    document.getElementById('result-mfgAdmin-cons').textContent = formatCurrency(mfgAdminCons);
    document.getElementById('result-mfgAdmin-likely').textContent = formatCurrency(mfgAdminLikely);
    
    document.getElementById('result-capacity-cons').textContent = formatCurrency(capacityCons);
    document.getElementById('result-capacity-likely').textContent = formatCurrency(capacityLikely);
    
    document.getElementById('result-waste-cons').textContent = formatCurrency(wasteCons);
    document.getElementById('result-waste-likely').textContent = formatCurrency(wasteLikely);
    
    document.getElementById('result-whAdmin-cons').textContent = formatCurrency(whAdminCons);
    document.getElementById('result-whAdmin-likely').textContent = formatCurrency(whAdminLikely);
    
    document.getElementById('result-labour-cons').textContent = formatCurrency(labourCons);
    document.getElementById('result-labour-likely').textContent = formatCurrency(labourLikely);
    
    document.getElementById('result-logistics-cons').textContent = formatCurrency(logisticsCons);
    document.getElementById('result-logistics-likely').textContent = formatCurrency(logisticsLikely);
    
    // Show results section
    document.getElementById('resultsSection').classList.add('show');
    
    // Scroll to results
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Prepare data for API submission
    const assessmentData = {
        companyName,
        contactEmail,
        annualRevenue,
        operatingMargin,
        mfgManagers,
        mfgManagerCost,
        shopFloorFTEs,
        shopFloorCost,
        annualWasteCost,
        warehouseManagers,
        warehouseManagerCost,
        warehouseEmployees,
        warehouseEmployeeCost,
        annualLogisticsCost,
        primaryChallenges: ['ROI Assessment'],
        technologyGaps: 'Supply Chain Execution ROI Assessment'
    };
    
    // Save to database (optional)
    saveToDatabase(assessmentData, {
        mfgAdminSavings: Math.round(mfgAdminCons),
        workforceSavings: Math.round(workforceCons),
        capacitySavings: Math.round(capacityCons),
        wasteSavings: Math.round(wasteCons),
        warehouseAdminSavings: Math.round(whAdminCons),
        labourSavings: Math.round(labourCons),
        logisticsSavings: Math.round(logisticsCons),
        totalAnnualSavings: Math.round(totalConservative),
        likely: {
            mfgAdminSavings: Math.round(mfgAdminLikely),
            workforceSavings: Math.round(workforceLikely),
            capacitySavings: Math.round(capacityLikely),
            wasteSavings: Math.round(wasteLikely),
            warehouseAdminSavings: Math.round(whAdminLikely),
            labourSavings: Math.round(labourLikely),
            logisticsSavings: Math.round(logisticsLikely),
            totalAnnualSavings: Math.round(totalLikely)
        },
        implementationCost: 0,
        paybackPeriod: 0,
        threeYearROI: 0
    });
}

async function saveToDatabase(data, roiResults) {
    const API_URL = '/.netlify/functions';
    
    try {
        const response = await fetch(`${API_URL}/create-assessment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...data,
                roiResults
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Assessment saved:', result.assessmentId);
            
            // Show success message
            const successMsg = document.createElement('div');
            successMsg.style.cssText = 'background: #d4edda; color: #155724; padding: 15px; margin: 20px; border-radius: 8px; text-align: center; font-weight: bold;';
            successMsg.innerHTML = `✅ Assessment saved successfully for ${data.companyName}! <br><small>Assessment ID: ${result.assessmentId}</small>`;
            document.getElementById('resultsSection').insertBefore(successMsg, document.getElementById('resultsSection').firstChild);
            
            // Store assessment ID
            sessionStorage.setItem('lastAssessmentId', result.assessmentId);
        } else {
            const error = await response.json();
            showError('Failed to save assessment: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error saving assessment:', error);
        showError('Error saving assessment to database. Results are displayed but not saved.');
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideError() {
    document.getElementById('errorMessage').classList.remove('show');
}
