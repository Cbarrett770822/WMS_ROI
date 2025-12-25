// Simple MongoDB Connection Test
require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
    console.log('🔍 Testing MongoDB Connection...\n');
    
    if (!process.env.MONGODB_URI) {
        console.error('❌ MONGODB_URI not found in .env file');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
        });

        console.log('✅ Successfully connected to MongoDB!\n');
        
        const db = mongoose.connection.db;
        console.log(`📊 Database: ${db.databaseName}`);
        
        const collections = await db.listCollections().toArray();
        console.log(`📁 Collections: ${collections.length}`);
        collections.forEach(col => console.log(`   - ${col.name}`));
        
        // Count documents in assessments collection
        const Assessment = require('./netlify/functions/models/Assessment');
        const count = await Assessment.countDocuments();
        console.log(`\n📝 Total Assessments: ${count}`);
        
        console.log('\n✅ DATABASE CONNECTION TEST PASSED!');
        console.log('🚀 Your WMS ROI app is ready to use!\n');
        
    } catch (error) {
        console.error('\n❌ Connection Failed!');
        console.error(`Error: ${error.message}\n`);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
    }
}

testConnection();
