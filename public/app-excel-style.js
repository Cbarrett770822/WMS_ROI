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
    
    // Workforce Productivity
    const shopFloorFTEs = parseFloat(document.getElementById('shopFloorFTEs').value) || 0;
    const shopFloorCost = parseFloat(document.getElementById('shopFloorCost').value) || 0;
    const shopFloorTotal = shopFloorFTEs * shopFloorCost;
    document.getElementById('shopFloorTotal').textContent = formatCurrency(shopFloorTotal);
    document.getElementById('shopFloorTotal2').textContent = formatCurrency(shopFloorTotal);
    document.getElementById('workforceBenefit1').textContent = formatCurrency(shopFloorTotal * 0.11);
    document.getElementById('workforceBenefit2').textContent = formatCurrency(shopFloorTotal * 0.14);
    
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
    
    // Direct Labour - Activity Based
    const warehouseEmployees = parseFloat(document.getElementById('warehouseEmployees').value) || 0;
    const warehouseEmployeeCost = parseFloat(document.getElementById('warehouseEmployeeCost').value) || 0;
    const whEmpTotal = warehouseEmployees * warehouseEmployeeCost;
    document.getElementById('whEmpTotal').textContent = formatCurrency(whEmpTotal);
    document.getElementById('whEmpTotal2').textContent = formatCurrency(whEmpTotal);
    
    // Get activity time percentages
    const timeGoodsIn = parseFloat(document.getElementById('timeGoodsIn').value) || 0;
    const timePutAway = parseFloat(document.getElementById('timePutAway').value) || 0;
    const timeReplenishment = parseFloat(document.getElementById('timeReplenishment').value) || 0;
    const timePick = parseFloat(document.getElementById('timePick').value) || 0;
    const timeLoading = parseFloat(document.getElementById('timeLoading').value) || 0;
    const timeStockCheck = parseFloat(document.getElementById('timeStockCheck').value) || 0;
    const timeOther = parseFloat(document.getElementById('timeOther').value) || 0;
    
    const timeGoodsIn2 = parseFloat(document.getElementById('timeGoodsIn2').value) || 0;
    const timePutAway2 = parseFloat(document.getElementById('timePutAway2').value) || 0;
    const timeReplenishment2 = parseFloat(document.getElementById('timeReplenishment2').value) || 0;
    const timePick2 = parseFloat(document.getElementById('timePick2').value) || 0;
    const timeLoading2 = parseFloat(document.getElementById('timeLoading2').value) || 0;
    const timeStockCheck2 = parseFloat(document.getElementById('timeStockCheck2').value) || 0;
    const timeOther2 = parseFloat(document.getElementById('timeOther2').value) || 0;
    
    // Calculate total time allocation
    const totalTime = timeGoodsIn + timePutAway + timeReplenishment + timePick + timeLoading + timeStockCheck + timeOther;
    const totalTime2 = timeGoodsIn2 + timePutAway2 + timeReplenishment2 + timePick2 + timeLoading2 + timeStockCheck2 + timeOther2;
    document.getElementById('totalTimeAlloc').textContent = totalTime.toFixed(1) + '%';
    document.getElementById('totalTimeAlloc2').textContent = totalTime2.toFixed(1) + '%';
    
    // Calculate activity savings (Conservative)
    const savingGoodsIn = whEmpTotal * (timeGoodsIn / 100) * 0.20;
    const savingPutAway = whEmpTotal * (timePutAway / 100) * 0.035;
    const savingReplenishment = whEmpTotal * (timeReplenishment / 100) * 0.07;
    const savingPick = whEmpTotal * (timePick / 100) * 0.061;
    const savingLoading = whEmpTotal * (timeLoading / 100) * 0.07;
    const savingStockCheck = whEmpTotal * (timeStockCheck / 100) * 0.07;
    const savingOther = whEmpTotal * (timeOther / 100) * 0.035;
    
    // Calculate activity savings (Likely)
    const savingGoodsIn2 = whEmpTotal * (timeGoodsIn2 / 100) * 0.30;
    const savingPutAway2 = whEmpTotal * (timePutAway2 / 100) * 0.05;
    const savingReplenishment2 = whEmpTotal * (timeReplenishment2 / 100) * 0.10;
    const savingPick2 = whEmpTotal * (timePick2 / 100) * 0.09;
    const savingLoading2 = whEmpTotal * (timeLoading2 / 100) * 0.10;
    const savingStockCheck2 = whEmpTotal * (timeStockCheck2 / 100) * 0.10;
    const savingOther2 = whEmpTotal * (timeOther2 / 100) * 0.05;
    
    // Display individual activity savings
    document.getElementById('savingGoodsIn').textContent = formatCurrency(savingGoodsIn);
    document.getElementById('savingPutAway').textContent = formatCurrency(savingPutAway);
    document.getElementById('savingReplenishment').textContent = formatCurrency(savingReplenishment);
    document.getElementById('savingPick').textContent = formatCurrency(savingPick);
    document.getElementById('savingLoading').textContent = formatCurrency(savingLoading);
    document.getElementById('savingStockCheck').textContent = formatCurrency(savingStockCheck);
    document.getElementById('savingOther').textContent = formatCurrency(savingOther);
    
    document.getElementById('savingGoodsIn2').textContent = formatCurrency(savingGoodsIn2);
    document.getElementById('savingPutAway2').textContent = formatCurrency(savingPutAway2);
    document.getElementById('savingReplenishment2').textContent = formatCurrency(savingReplenishment2);
    document.getElementById('savingPick2').textContent = formatCurrency(savingPick2);
    document.getElementById('savingLoading2').textContent = formatCurrency(savingLoading2);
    document.getElementById('savingStockCheck2').textContent = formatCurrency(savingStockCheck2);
    document.getElementById('savingOther2').textContent = formatCurrency(savingOther2);
    
    // Calculate total savings
    const totalLabourSavings = savingGoodsIn + savingPutAway + savingReplenishment + savingPick + savingLoading + savingStockCheck + savingOther;
    const totalLabourSavings2 = savingGoodsIn2 + savingPutAway2 + savingReplenishment2 + savingPick2 + savingLoading2 + savingStockCheck2 + savingOther2;
    
    // Calculate total saving percentages
    const totalSavingPct = (totalLabourSavings / whEmpTotal) * 100;
    const totalSavingPct2 = (totalLabourSavings2 / whEmpTotal) * 100;
    document.getElementById('totalSavingPct').textContent = totalSavingPct.toFixed(1) + '%';
    document.getElementById('totalSavingPct2').textContent = totalSavingPct2.toFixed(1) + '%';
    
    // Display total labour benefits
    document.getElementById('labourBenefit1').textContent = formatCurrency(totalLabourSavings);
    document.getElementById('labourBenefit2').textContent = formatCurrency(totalLabourSavings2);
    
    // Logistics
    const annualLogisticsCost = parseFloat(document.getElementById('annualLogisticsCost').value) || 0;
    document.getElementById('logisticsBenefit1').textContent = formatCurrency(annualLogisticsCost * 0.20);
    document.getElementById('logisticsBenefit2').textContent = formatCurrency(annualLogisticsCost * 0.40);
}

function calculateROI() {
    // Get all values
    const mfgManagers = parseFloat(document.getElementById('mfgManagers').value) || 0;
    const mfgManagerCost = parseFloat(document.getElementById('mfgManagerCost').value) || 0;
    const shopFloorFTEs = parseFloat(document.getElementById('shopFloorFTEs').value) || 0;
    const shopFloorCost = parseFloat(document.getElementById('shopFloorCost').value) || 0;
    const annualRevenue = parseFloat(document.getElementById('annualRevenue').value) || 0;
    const operatingMargin = parseFloat(document.getElementById('operatingMargin').value) || 0;
    const annualWasteCost = parseFloat(document.getElementById('annualWasteCost').value) || 0;
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
    
    // Activity-based labour calculations
    const whEmpTotal = warehouseEmployees * warehouseEmployeeCost;
    
    // Get activity time percentages
    const timeGoodsIn = parseFloat(document.getElementById('timeGoodsIn').value) || 0;
    const timePutAway = parseFloat(document.getElementById('timePutAway').value) || 0;
    const timeReplenishment = parseFloat(document.getElementById('timeReplenishment').value) || 0;
    const timePick = parseFloat(document.getElementById('timePick').value) || 0;
    const timeLoading = parseFloat(document.getElementById('timeLoading').value) || 0;
    const timeStockCheck = parseFloat(document.getElementById('timeStockCheck').value) || 0;
    const timeOther = parseFloat(document.getElementById('timeOther').value) || 0;
    
    const timeGoodsIn2 = parseFloat(document.getElementById('timeGoodsIn2').value) || 0;
    const timePutAway2 = parseFloat(document.getElementById('timePutAway2').value) || 0;
    const timeReplenishment2 = parseFloat(document.getElementById('timeReplenishment2').value) || 0;
    const timePick2 = parseFloat(document.getElementById('timePick2').value) || 0;
    const timeLoading2 = parseFloat(document.getElementById('timeLoading2').value) || 0;
    const timeStockCheck2 = parseFloat(document.getElementById('timeStockCheck2').value) || 0;
    const timeOther2 = parseFloat(document.getElementById('timeOther2').value) || 0;
    
    // Calculate activity savings (Conservative)
    const savingGoodsIn = whEmpTotal * (timeGoodsIn / 100) * 0.20;
    const savingPutAway = whEmpTotal * (timePutAway / 100) * 0.035;
    const savingReplenishment = whEmpTotal * (timeReplenishment / 100) * 0.07;
    const savingPick = whEmpTotal * (timePick / 100) * 0.061;
    const savingLoading = whEmpTotal * (timeLoading / 100) * 0.07;
    const savingStockCheck = whEmpTotal * (timeStockCheck / 100) * 0.07;
    const savingOther = whEmpTotal * (timeOther / 100) * 0.035;
    
    // Calculate activity savings (Likely)
    const savingGoodsIn2 = whEmpTotal * (timeGoodsIn2 / 100) * 0.30;
    const savingPutAway2 = whEmpTotal * (timePutAway2 / 100) * 0.05;
    const savingReplenishment2 = whEmpTotal * (timeReplenishment2 / 100) * 0.10;
    const savingPick2 = whEmpTotal * (timePick2 / 100) * 0.09;
    const savingLoading2 = whEmpTotal * (timeLoading2 / 100) * 0.10;
    const savingStockCheck2 = whEmpTotal * (timeStockCheck2 / 100) * 0.10;
    const savingOther2 = whEmpTotal * (timeOther2 / 100) * 0.05;
    
    // Total labour savings
    const labourCons = savingGoodsIn + savingPutAway + savingReplenishment + savingPick + savingLoading + savingStockCheck + savingOther;
    const labourLikely = savingGoodsIn2 + savingPutAway2 + savingReplenishment2 + savingPick2 + savingLoading2 + savingStockCheck2 + savingOther2;
    
    const logisticsCons = annualLogisticsCost * 0.20;
    const logisticsLikely = annualLogisticsCost * 0.40;
    
    // Calculate totals
    const totalConservative = mfgAdminCons + workforceCons + capacityCons + wasteCons + labourCons + logisticsCons;
    const totalLikely = mfgAdminLikely + workforceLikely + capacityLikely + wasteLikely + labourLikely + logisticsLikely;
    
    // Display results
    document.getElementById('totalConservative').textContent = formatCurrency(totalConservative);
    document.getElementById('totalLikely').textContent = formatCurrency(totalLikely);
    
    document.getElementById('result-mfgAdmin-cons').textContent = formatCurrency(mfgAdminCons);
    document.getElementById('result-mfgAdmin-likely').textContent = formatCurrency(mfgAdminLikely);
    
    document.getElementById('result-workforce-cons').textContent = formatCurrency(workforceCons);
    document.getElementById('result-workforce-likely').textContent = formatCurrency(workforceLikely);
    
    document.getElementById('result-capacity-cons').textContent = formatCurrency(capacityCons);
    document.getElementById('result-capacity-likely').textContent = formatCurrency(capacityLikely);
    
    document.getElementById('result-waste-cons').textContent = formatCurrency(wasteCons);
    document.getElementById('result-waste-likely').textContent = formatCurrency(wasteLikely);
    
    document.getElementById('result-labour-cons').textContent = formatCurrency(labourCons);
    document.getElementById('result-labour-likely').textContent = formatCurrency(labourLikely);
    
    document.getElementById('result-logistics-cons').textContent = formatCurrency(logisticsCons);
    document.getElementById('result-logistics-likely').textContent = formatCurrency(logisticsLikely);
    
    // Show results section
    document.getElementById('resultsSection').classList.add('show');
    
    // Scroll to results
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Get company info from form
    const companyName = document.getElementById('companyName').value.trim();
    
    // Store data globally for save button
    window.assessmentData = {
        companyName: companyName || 'Unknown Company',
        annualRevenue,
        operatingMargin,
        mfgManagers,
        mfgManagerCost,
        shopFloorFTEs,
        shopFloorCost,
        annualWasteCost,
        warehouseEmployees,
        warehouseEmployeeCost,
        annualLogisticsCost,
        primaryChallenges: ['ROI Assessment'],
        technologyGaps: 'Supply Chain Execution ROI Assessment'
    };
    
    window.roiResults = {
        mfgAdminSavings: Math.round(mfgAdminCons),
        workforceSavings: Math.round(workforceCons),
        capacitySavings: Math.round(capacityCons),
        wasteSavings: Math.round(wasteCons),
        labourSavings: Math.round(labourCons),
        logisticsSavings: Math.round(logisticsCons),
        totalAnnualSavings: Math.round(totalConservative),
        likely: {
            mfgAdminSavings: Math.round(mfgAdminLikely),
            workforceSavings: Math.round(workforceLikely),
            capacitySavings: Math.round(capacityLikely),
            wasteSavings: Math.round(wasteLikely),
            labourSavings: Math.round(labourLikely),
            logisticsSavings: Math.round(logisticsLikely),
            totalAnnualSavings: Math.round(totalLikely)
        },
        implementationCost: 0,
        paybackPeriod: 0,
        threeYearROI: 0
    };
}

function saveAssessment() {
    if (!window.assessmentData || !window.roiResults) {
        alert('Please calculate ROI first');
        return;
    }
    saveToDatabase(window.assessmentData, window.roiResults, window.currentAssessmentId);
}

async function saveToDatabase(data, roiResults, assessmentId) {
    const API_URL = '/.netlify/functions';
    
    try {
        // Determine if we're creating or updating
        const isUpdate = !!assessmentId;
        const endpoint = isUpdate ? 'update-assessment' : 'create-assessment';
        const method = 'POST';
        
        const payload = {
            ...data,
            roiResults
        };
        
        if (isUpdate) {
            payload.id = assessmentId;
        }
        
        const response = await fetch(`${API_URL}/${endpoint}`, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            const result = await response.json();
            const message = isUpdate ? 'Assessment updated successfully!' : 'Assessment saved successfully!';
            const id = result.assessmentId || assessmentId;
            alert(`✅ ${message}\n\nAssessment ID: ${id}`);
            window.location.href = 'index.html';
        } else {
            const error = await response.json();
            alert('Failed to save: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error saving assessment:', error);
        alert('Error saving assessment. Please try again.');
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
