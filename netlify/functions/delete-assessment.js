const { connectToDatabase } = require('./utils/db');
const Assessment = require('./models/Assessment');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'DELETE') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };
    }

    try {
        await connectToDatabase();
        const id = event.queryStringParameters?.id;

        if (!id) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'ID required' })
            };
        }

        const result = await Assessment.findByIdAndDelete(id);

        if (!result) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ success: false, error: 'Not found' })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Deleted successfully' })
        };
    } catch (error) {
        console.error('Delete error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
