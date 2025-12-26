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

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    await connectToDatabase();

    const { limit = 50, skip = 0 } = event.queryStringParameters || {};

    const assessments = await Assessment.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .select('-__v');

    const total = await Assessment.countDocuments();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        assessments,
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      })
    };

  } catch (error) {
    console.error('Error listing assessments:', error);
    console.error('Error stack:', error.stack);
    console.error('MongoDB URI exists:', !!process.env.MONGODB_URI);
    console.error('MongoDB URI prefix:', process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 20) : 'MISSING');
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to list assessments',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        mongoConfigured: !!process.env.MONGODB_URI
      })
    };
  }
};
