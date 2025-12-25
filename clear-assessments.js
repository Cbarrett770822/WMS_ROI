require('dotenv').config();
const mongoose = require('mongoose');
const Assessment = require('./netlify/functions/models/Assessment');

async function clearAssessments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const result = await Assessment.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} assessments`);
    
    await mongoose.connection.close();
    console.log('Database cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

clearAssessments();
