// PDF Generator for WMS Savings & Benefits Assessment
// Comprehensive report with explanations and impact analysis

async function loadJsPDF() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function generatePDFReport(event) {
    if (!window.assessmentData || !window.roiResults) {
        alert('Please calculate Savings & Benefits first');
        return;
    }

    try {
        // Show loading message
        const btn = event ? event.target : null;
        const originalText = btn ? btn.textContent : '';
        if (btn) {
            btn.textContent = 'Generating PDF...';
            btn.disabled = true;
        }

        // Load jsPDF library dynamically
        if (typeof window.jspdf === 'undefined') {
            await loadJsPDF();
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        const data = window.assessmentData;
        const results = window.roiResults;
        
        let yPos = 20;
        const pageWidth = 210;
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);
        
        // Helper functions
        function checkPageBreak(requiredSpace = 20) {
            if (yPos + requiredSpace > 280) {
                doc.addPage();
                yPos = 20;
                return true;
            }
            return false;
        }
        
        function addWrappedText(text, x, y, maxWidth, fontSize = 10) {
            doc.setFontSize(fontSize);
            const lines = doc.splitTextToSize(text, maxWidth);
            doc.text(lines, x, y);
            return lines.length * (fontSize * 0.35);
        }
        
        function formatCurrency(amount) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(amount);
        }
        
        // ===== COVER PAGE =====
        doc.setFillColor(51, 51, 51);
        doc.rect(0, 0, pageWidth, 80, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(28);
        doc.setFont(undefined, 'bold');
        doc.text('Infor WMS', pageWidth / 2, 35, { align: 'center' });
        doc.setFontSize(22);
        doc.text('Savings & Benefits Assessment', pageWidth / 2, 50, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setFont(undefined, 'normal');
        doc.text(data.companyName, pageWidth / 2, 65, { align: 'center' });
        
        doc.setTextColor(0, 0, 0);
        yPos = 100;
        
        // Executive Summary Box
        doc.setFillColor(240, 240, 240);
        doc.roundedRect(margin, yPos, contentWidth, 60, 3, 3, 'F');
        
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('Executive Summary', margin + 5, yPos + 10);
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text('Conservative Estimate:', margin + 5, yPos + 25);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(18);
        doc.setTextColor(0, 128, 0);
        doc.text(formatCurrency(results.totalAnnualSavings), margin + 5, yPos + 35);
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text('Likely Estimate:', margin + 95, yPos + 25);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(18);
        doc.setTextColor(0, 128, 0);
        doc.text(formatCurrency(results.likely.totalAnnualSavings), margin + 95, yPos + 35);
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont(undefined, 'italic');
        doc.text('Annual savings potential from Infor WMS implementation', margin + 5, yPos + 50);
        
        yPos += 75;
        
        // Company Information
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Company Information', margin, yPos);
        yPos += 8;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Company: ${data.companyName}`, margin, yPos);
        yPos += 6;
        doc.text(`Report Date: ${new Date().toLocaleDateString()}`, margin, yPos);
        yPos += 15;
        
        // ===== PAGE 2: DETAILED RESULTS =====
        doc.addPage();
        yPos = 20;
        
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text('Detailed Savings & Benefits Analysis', margin, yPos);
        yPos += 10;
        
        // Results Table
        const categories = [
            { name: 'Management & Admin Productivity', cons: results.mfgAdminSavings, likely: results.likely.mfgAdminSavings },
            { name: 'Capacity & Throughput', cons: results.capacitySavings, likely: results.likely.capacitySavings },
            { name: 'Waste Reduction', cons: results.wasteSavings, likely: results.likely.wasteSavings },
            { name: 'Warehouse Admin Productivity', cons: results.warehouseAdminSavings, likely: results.likely.warehouseAdminSavings },
            { name: 'Direct Labour Cost Reduction', cons: results.labourSavings, likely: results.likely.labourSavings },
            { name: 'Transportation & Logistics', cons: results.logisticsSavings, likely: results.likely.logisticsSavings }
        ];
        
        // Table header
        doc.setFillColor(51, 51, 51);
        doc.rect(margin, yPos, contentWidth, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Benefit Category', margin + 2, yPos + 7);
        doc.text('Conservative', margin + 105, yPos + 7);
        doc.text('Likely', margin + 145, yPos + 7);
        yPos += 10;
        
        // Table rows
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        categories.forEach((cat, index) => {
            if (index % 2 === 0) {
                doc.setFillColor(245, 245, 245);
                doc.rect(margin, yPos, contentWidth, 8, 'F');
            }
            doc.setFontSize(9);
            doc.text(cat.name, margin + 2, yPos + 5.5);
            doc.text(formatCurrency(cat.cons), margin + 105, yPos + 5.5);
            doc.text(formatCurrency(cat.likely), margin + 145, yPos + 5.5);
            yPos += 8;
        });
        
        // Total row
        doc.setFillColor(51, 51, 51);
        doc.rect(margin, yPos, contentWidth, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('TOTAL ANNUAL SAVINGS', margin + 2, yPos + 7);
        doc.text(formatCurrency(results.totalAnnualSavings), margin + 105, yPos + 7);
        doc.text(formatCurrency(results.likely.totalAnnualSavings), margin + 145, yPos + 7);
        yPos += 20;
        
        // ===== PAGE 3: METHODOLOGY & EXPLANATIONS =====
        doc.addPage();
        yPos = 20;
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text('Savings & Benefits Methodology & Benchmarks', margin, yPos);
        yPos += 12;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        const introText = 'This assessment uses industry-proven benchmarks from Infor WMS implementations across hundreds of warehouse operations. The percentages represent realistic improvement ranges based on actual customer results.';
        yPos += addWrappedText(introText, margin, yPos, contentWidth, 10);
        yPos += 10;
        
        // Detailed explanations for each category
        const explanations = [
            {
                title: 'Management & Administration Productivity (11-14%)',
                description: 'Reduction in administrative time through system consolidation and automation.',
                benefits: [
                    'Single consolidated system eliminates duplicate data entry',
                    'Automated reporting reduces manual report generation',
                    'Real-time visibility eliminates status inquiry calls',
                    'Streamlined workflows reduce coordination overhead'
                ],
                impact: 'Managers and supervisors spend less time on administrative tasks and more time on strategic activities and team development.'
            },
            {
                title: 'Capacity & Throughput Improvement (12-38%)',
                description: 'Revenue impact from improved on-time delivery and customer satisfaction.',
                benefits: [
                    'Better order accuracy increases customer retention',
                    'Faster order processing enables more throughput',
                    'Improved delivery performance attracts new business',
                    'Reduced stockouts capture more sales opportunities'
                ],
                impact: 'Higher customer satisfaction leads to repeat business and referrals, directly impacting revenue growth without proportional cost increases.'
            },
            {
                title: 'Waste & Scrap Reduction (13-16%)',
                description: 'Reduction in damaged goods, expired inventory, and operational waste.',
                benefits: [
                    'Better inventory rotation (FIFO/FEFO) reduces expiration',
                    'Improved handling procedures reduce damage',
                    'Accurate tracking prevents obsolescence',
                    'Quality controls catch issues earlier'
                ],
                impact: 'Less waste means lower material costs and improved profitability on every order processed.'
            },
            {
                title: 'Warehouse Admin Productivity (11-14%)',
                description: 'Time savings in inventory management and warehouse administration.',
                benefits: [
                    'Automated cycle counting reduces manual inventory checks',
                    'Real-time inventory accuracy eliminates reconciliation',
                    'System-directed workflows reduce planning time',
                    'Automated compliance documentation'
                ],
                impact: 'Warehouse managers focus on optimization and continuous improvement rather than firefighting and data management.'
            },
            {
                title: 'Direct Labour Cost Reduction (8.6-12.6%)',
                description: 'Productivity improvements in warehouse floor operations.',
                benefits: [
                    'Optimized pick paths reduce travel time (20-30% reduction)',
                    'Wave picking increases picks per hour',
                    'Directed putaway reduces search time',
                    'Task interleaving eliminates empty travel',
                    'Mobile devices eliminate paper and trips to office',
                    'Real-time task assignment optimizes workforce'
                ],
                impact: 'Same workforce handles more volume, or reduced workforce handles current volume. Flexibility to scale without proportional labor increases.'
            },
            {
                title: 'Transportation & Logistics Savings (20-40%)',
                description: 'Freight cost reduction through better planning and execution.',
                benefits: [
                    'Load optimization improves truck utilization (8-15%)',
                    'Predictable volumes enable better carrier planning (7-15%)',
                    'Accurate shipping reduces freight claims',
                    'Route optimization reduces miles and fuel (5-10%)',
                    'Consolidated shipments reduce LTL costs'
                ],
                impact: 'Lower per-unit shipping costs improve margins. Better carrier relationships through predictable volumes lead to better rates.'
            }
        ];
        
        explanations.forEach((exp, index) => {
            checkPageBreak(60);
            
            // Title
            doc.setFillColor(51, 51, 51);
            doc.rect(margin, yPos, contentWidth, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text(exp.title, margin + 2, yPos + 5.5);
            yPos += 12;
            
            doc.setTextColor(0, 0, 0);
            
            // Description
            doc.setFontSize(10);
            doc.setFont(undefined, 'italic');
            yPos += addWrappedText(exp.description, margin, yPos, contentWidth, 10);
            yPos += 5;
            
            // Benefits
            doc.setFont(undefined, 'bold');
            doc.setFontSize(10);
            doc.text('Key Benefits:', margin, yPos);
            yPos += 6;
            
            doc.setFont(undefined, 'normal');
            doc.setFontSize(9);
            exp.benefits.forEach(benefit => {
                checkPageBreak(10);
                doc.text('•', margin + 2, yPos);
                yPos += addWrappedText(benefit, margin + 6, yPos, contentWidth - 6, 9);
                yPos += 1;
            });
            yPos += 3;
            
            // Impact
            doc.setFont(undefined, 'bold');
            doc.setFontSize(10);
            doc.text('Operational Impact:', margin, yPos);
            yPos += 6;
            
            doc.setFont(undefined, 'normal');
            doc.setFontSize(9);
            yPos += addWrappedText(exp.impact, margin, yPos, contentWidth, 9);
            yPos += 10;
        });
        
        // ===== PAGE: INFOR WMS VALUE PROPOSITION =====
        doc.addPage();
        yPos = 20;
        
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text('Why Infor WMS?', margin, yPos);
        yPos += 12;
        
        const wmsFeatures = [
            {
                title: 'Advanced Warehouse Management',
                points: [
                    'RF-directed workflows for all warehouse operations',
                    'Wave planning and optimization for efficient picking',
                    'Task interleaving to maximize labor productivity',
                    'Dynamic slotting based on velocity and characteristics',
                    'Multi-modal picking strategies (piece, case, pallet)'
                ]
            },
            {
                title: 'Inventory Optimization',
                points: [
                    'Real-time inventory visibility across all locations',
                    'Automated cycle counting with ABC classification',
                    'Lot and serial number tracking with full traceability',
                    'FIFO/FEFO/LIFO inventory rotation strategies',
                    'Quality hold and inspection workflows'
                ]
            },
            {
                title: 'Labor Management',
                points: [
                    'Engineered labor standards for all activities',
                    'Real-time performance monitoring and coaching',
                    'Incentive program support',
                    'Workforce planning and scheduling',
                    'Training and certification tracking'
                ]
            },
            {
                title: 'Integration & Scalability',
                points: [
                    'Seamless ERP integration (Infor CloudSuite, SAP, Oracle, etc.)',
                    'EDI and API connectivity for trading partners',
                    'Support for automation (AS/RS, conveyors, sortation)',
                    'Cloud-based deployment for rapid implementation',
                    'Multi-site and multi-client capabilities'
                ]
            }
        ];
        
        wmsFeatures.forEach(feature => {
            checkPageBreak(40);
            
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setFillColor(240, 240, 240);
            doc.rect(margin, yPos - 2, contentWidth, 7, 'F');
            doc.text(feature.title, margin + 2, yPos + 3);
            yPos += 12;
            
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            feature.points.forEach(point => {
                checkPageBreak(8);
                doc.text('✓', margin + 2, yPos);
                yPos += addWrappedText(point, margin + 7, yPos, contentWidth - 7, 9);
                yPos += 1;
            });
            yPos += 5;
        });
        
        // Footer on last page
        yPos = 280;
        doc.setFontSize(8);
        doc.setFont(undefined, 'italic');
        doc.setTextColor(128, 128, 128);
        doc.text('This assessment is based on industry benchmarks and actual customer results. Individual results may vary based on specific operational characteristics.', pageWidth / 2, yPos, { align: 'center' });
        doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPos + 4, { align: 'center' });
        
        // Save the PDF
        const fileName = `Infor_WMS_Savings_Benefits_Assessment_${data.companyName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
        
        // Restore button
        if (btn) {
            btn.textContent = originalText;
            btn.disabled = false;
        }
        
        alert('PDF report generated successfully!');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error generating PDF: ' + error.message);
        if (event && event.target) {
            event.target.textContent = 'Export PDF Report';
            event.target.disabled = false;
        }
    }
}
