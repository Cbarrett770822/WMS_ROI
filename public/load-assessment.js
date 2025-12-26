// Store current assessment ID globally
window.currentAssessmentId = null;

// Load assessment data when ID is in URL
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const assessmentId = urlParams.get('id');
    
    if (assessmentId) {
        window.currentAssessmentId = assessmentId;
        loadAssessment(assessmentId);
    }
});

async function loadAssessment(id) {
    const API_URL = '/.netlify/functions';
    
    try {
        const response = await fetch(`${API_URL}/get-assessment?id=${id}`);
        if (response.ok) {
            const data = await response.json();
            const assessment = data.assessment; // Extract assessment from response
            
            console.log('Loaded assessment:', assessment); // Debug log
            
            // Pre-fill form fields
            if (assessment.companyName) document.getElementById('companyName').value = assessment.companyName;
            if (assessment.contactEmail) document.getElementById('contactEmail').value = assessment.contactEmail;
            if (assessment.annualRevenue) document.getElementById('annualRevenue').value = assessment.annualRevenue;
            if (assessment.operatingMargin) document.getElementById('operatingMargin').value = assessment.operatingMargin;
            if (assessment.mfgManagers) document.getElementById('mfgManagers').value = assessment.mfgManagers;
            if (assessment.mfgManagerCost) document.getElementById('mfgManagerCost').value = assessment.mfgManagerCost;
            if (assessment.shopFloorFTEs) document.getElementById('shopFloorFTEs').value = assessment.shopFloorFTEs;
            if (assessment.shopFloorCost) document.getElementById('shopFloorCost').value = assessment.shopFloorCost;
            if (assessment.annualWasteCost) document.getElementById('annualWasteCost').value = assessment.annualWasteCost;
            if (assessment.warehouseManagers) document.getElementById('warehouseManagers').value = assessment.warehouseManagers;
            if (assessment.warehouseManagerCost) document.getElementById('warehouseManagerCost').value = assessment.warehouseManagerCost;
            if (assessment.warehouseEmployees) document.getElementById('warehouseEmployees').value = assessment.warehouseEmployees;
            if (assessment.warehouseEmployeeCost) document.getElementById('warehouseEmployeeCost').value = assessment.warehouseEmployeeCost;
            if (assessment.annualLogisticsCost) document.getElementById('annualLogisticsCost').value = assessment.annualLogisticsCost;
            
            // Trigger calculation
            updateCalculatedFields();
            calculateROI();
        }
    } catch (error) {
        console.error('Error loading assessment:', error);
    }
}
