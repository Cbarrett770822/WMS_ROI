// Test MongoDB Connection
// Run this with: node test-db-connection.js

require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
    console.log('🔍 Testing MongoDB Connection...\n');
    
    // Check if MONGODB_URI is set
    if (!process.env.MONGODB_URI) {
        console.error('❌ ERROR: MONGODB_URI environment variable is not set!');
        console.log('\nPlease create a .env file with:');
        console.log('MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/wms_roi?retryWrites=true&w=majority');
        process.exit(1);
    }

    console.log('📋 Connection String Found');
    console.log('🔗 Attempting to connect...\n');

    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
        });

        console.log('✅ Successfully connected to MongoDB!\n');
        
        // Get connection details
        const db = mongoose.connection.db;
        const dbName = db.databaseName;
        
        console.log('📊 Database Information:');
        console.log(`   Database Name: ${dbName}`);
        console.log(`   Connection State: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Not Connected'}`);
        
        // List collections
        const collections = await db.listCollections().toArray();
        console.log(`\n📁 Collections (${collections.length}):`);
        if (collections.length > 0) {
            collections.forEach(col => {
                console.log(`   - ${col.name}`);
            });
        } else {
            console.log('   (No collections yet - will be created on first insert)');
        }

        // Test Assessment model
        const Assessment = require('./netlify/functions/models/Assessment');
        const count = await Assessment.countDocuments();
        console.log(`\n📝 Assessments in database: ${count}`);

        if (count > 0) {
            const latest = await Assessment.findOne().sort({ createdAt: -1 });
            console.log('\n🔍 Latest Assessment:');
            console.log(`   Company: ${latest.companyName || 'N/A'}`);
            console.log(`   Email: ${latest.contactEmail || 'N/A'}`);
            console.log(`   Date: ${new Date(latest.createdAt).toLocaleString()}`);
            if (latest.roiResults && latest.roiResults.totalAnnualSavings) {
                console.log(`   Total Savings: $${latest.roiResults.totalAnnualSavings.toLocaleString()}`);
            }
        }

        console.log('\n✅ Database connection test PASSED!');
        console.log('🚀 Your application is ready to use.\n');

    } catch (error) {
        console.error('\n❌ Connection FAILED!');
        console.error('\nError Details:');
        console.error(`   Type: ${error.name}`);
        console.error(`   Message: ${error.message}`);
        
        if (error.message.includes('authentication')) {
            console.error('\n💡 Troubleshooting:');
            console.error('   - Check your username and password in the connection string');
            console.error('   - Ensure the database user has read/write permissions');
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('timeout')) {
            console.error('\n💡 Troubleshooting:');
            console.error('   - Check your internet connection');
            console.error('   - Verify the cluster URL is correct');
            console.error('   - Check MongoDB Atlas IP whitelist (add 0.0.0.0/0 for testing)');
        }
        
        process.exit(1);
    } finally {
        // Close connection
        await mongoose.connection.close();
        console.log('🔌 Connection closed.\n');
    }
}

// Run the test
testConnection();
