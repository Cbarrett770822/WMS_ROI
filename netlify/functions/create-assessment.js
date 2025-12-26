const { connectToDatabase } = require('./utils/db');
const Assessment = require('./models/Assessment');
const { calculateWMSROI } = require('./utils/roiCalculator');

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    await connectToDatabase();

    const data = JSON.parse(event.body);

    // Validate required fields
    const requiredFields = ['companyName'];

    const missingFields = requiredFields.filter(field => !data[field]);
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing required fields',
          missingFields
        })
      };
    }

    // Use provided roiResults or calculate if not provided
    let roiResults = data.roiResults;

    // Create assessment with ROI results
    const assessment = new Assessment({
      ...data,
      roiResults,
      status: 'completed'
    });

    await assessment.save();

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        assessmentId: assessment._id,
        roiResults: assessment.roiResults
      })
    };

  } catch (error) {
    console.error('Error creating assessment:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to create assessment',
        message: error.message
      })
    };
  }
};
