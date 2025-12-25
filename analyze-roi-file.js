const XLSX = require('xlsx');
const path = require('path');

const filePath = process.argv[2];

if (!filePath) {
    console.error('Usage: node analyze-roi-file.js <path-to-excel-file>');
    process.exit(1);
}

try {
    console.log(`\n📊 Analyzing WMS ROI File: ${path.basename(filePath)}\n`);
    
    const workbook = XLSX.readFile(filePath);
    
    console.log(`📁 Sheets found: ${workbook.SheetNames.length}`);
    workbook.SheetNames.forEach((name, index) => {
        console.log(`   ${index + 1}. ${name}`);
    });
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    // Analyze each sheet
    workbook.SheetNames.forEach((sheetName) => {
        console.log(`\n📄 SHEET: ${sheetName}`);
        console.log('-'.repeat(80));
        
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        // Display first 50 rows
        const displayRows = Math.min(50, data.length);
        console.log(`Displaying first ${displayRows} rows:\n`);
        
        data.slice(0, displayRows).forEach((row, index) => {
            if (row.some(cell => cell !== '')) {
                const rowNum = (index + 1).toString().padStart(3, ' ');
                const rowData = row.map(cell => {
                    if (cell === null || cell === undefined || cell === '') return '';
                    return String(cell).substring(0, 50);
                }).join(' | ');
                console.log(`${rowNum}: ${rowData}`);
            }
        });
        
        console.log(`\nTotal rows: ${data.length}`);
        console.log('\n' + '='.repeat(80));
    });
    
    console.log('\n✅ Analysis complete!\n');
    
} catch (error) {
    console.error('❌ Error reading file:', error.message);
    process.exit(1);
}
