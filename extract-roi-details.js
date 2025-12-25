const XLSX = require('xlsx');

const filePath = "E:\\1_WORK\\1_Infor WMS\\WMS-2022\\ROI\\(Simple version )Infor_WMS_Benefit Analysis V2.xlsx";

try {
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets['SCE'];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    console.log('\n📊 WMS ROI BENEFIT CATEGORIES & CALCULATIONS\n');
    console.log('='.repeat(100) + '\n');
    
    // Extract benefit categories and their calculations
    const benefits = [];
    let currentBenefit = null;
    
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const firstCol = String(row[0] || '').trim();
        
        // Identify benefit categories
        if (firstCol && !firstCol.includes('INPUT') && !firstCol.includes('Output') && 
            (row[1] === 'Conservative' || String(row[1]).includes('$'))) {
            
            if (currentBenefit) {
                benefits.push(currentBenefit);
            }
            
            currentBenefit = {
                name: firstCol,
                conservative: row[1],
                likely: row[2],
                inputs: [],
                calculations: []
            };
        }
        
        // Capture input variables and calculations
        if (currentBenefit && firstCol && firstCol !== currentBenefit.name) {
            const dataType = row[3];
            const value1 = row[1];
            const value2 = row[2];
            
            if (dataType === 'User Input' || dataType === 'Benchmark' || dataType === 'Calculation' || dataType === 'Output') {
                currentBenefit.inputs.push({
                    field: firstCol,
                    conservative: value1,
                    likely: value2,
                    type: dataType,
                    source: row[4] || ''
                });
            }
        }
    }
    
    if (currentBenefit) {
        benefits.push(currentBenefit);
    }
    
    // Display findings
    benefits.forEach((benefit, index) => {
        console.log(`${index + 1}. ${benefit.name}`);
        console.log(`   Conservative: ${benefit.conservative}`);
        console.log(`   Likely: ${benefit.likely}`);
        console.log(`   Inputs:`);
        
        benefit.inputs.forEach(input => {
            console.log(`      - ${input.field}`);
            console.log(`        Type: ${input.type}`);
            if (input.type === 'User Input') {
                console.log(`        Value: ${input.conservative}`);
            } else if (input.type === 'Benchmark') {
                console.log(`        Benchmark: ${input.conservative} (Conservative) / ${input.likely} (Likely)`);
                if (input.source) console.log(`        Source: ${input.source}`);
            }
        });
        console.log('');
    });
    
    console.log('\n' + '='.repeat(100));
    console.log('\n📋 SUMMARY OF BENCHMARK VALUES:\n');
    
    benefits.forEach(benefit => {
        const benchmarks = benefit.inputs.filter(i => i.type === 'Benchmark');
        if (benchmarks.length > 0) {
            console.log(`${benefit.name}:`);
            benchmarks.forEach(b => {
                console.log(`  - ${b.field}: ${(parseFloat(b.conservative) * 100).toFixed(1)}% (Conservative) / ${(parseFloat(b.likely) * 100).toFixed(1)}% (Likely)`);
            });
            console.log('');
        }
    });
    
} catch (error) {
    console.error('Error:', error.message);
}
