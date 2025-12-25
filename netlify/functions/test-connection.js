// Netlify Function to Test Database Connection
const { connectToDatabase } = require('./utils/db');
const Assessment = require('./models/Assessment');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Test connection
    await connectToDatabase();
    
    // Get database stats
    const count = await Assessment.countDocuments();
    
    let latestAssessment = null;
    if (count > 0) {
      latestAssessment = await Assessment.findOne()
        .sort({ createdAt: -1 })
        .select('companyName contactEmail createdAt roiResults.totalAnnualSavings');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Database connection successful!',
        stats: {
          totalAssessments: count,
          latestAssessment: latestAssessment ? {
            company: latestAssessment.companyName,
            email: latestAssessment.contactEmail,
            date: latestAssessment.createdAt,
            savings: latestAssessment.roiResults.totalAnnualSavings
          } : null
        },
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Database connection test failed:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Database connection failed',
        message: error.message,
        details: {
          name: error.name,
          code: error.code
        }
      })
    };
  }
};
