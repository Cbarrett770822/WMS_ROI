const { connectToDatabase } = require('./utils/db');
const Assessment = require('./models/Assessment');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

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
    const { id, ...updateData } = data;

    if (!id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Assessment ID is required' })
      };
    }

    const assessment = await Assessment.findByIdAndUpdate(
      id,
      {
        ...updateData,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    );

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
        assessmentId: assessment._id,
        message: 'Assessment updated successfully'
      })
    };

  } catch (error) {
    console.error('Error updating assessment:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to update assessment',
        message: error.message
      })
    };
  }
};
