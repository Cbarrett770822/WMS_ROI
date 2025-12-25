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

    const { id } = event.queryStringParameters || {};

    if (!id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Assessment ID is required' })
      };
    }

    const assessment = await Assessment.findById(id);

    if (!assessment) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Assessment not found' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        assessment
      })
    };

  } catch (error) {
    console.error('Error fetching assessment:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch assessment',
        message: error.message
      })
    };
  }
};
