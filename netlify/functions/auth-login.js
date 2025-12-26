const { connectToDatabase } = require('./utils/db');
const User = require('./models/User');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
      body: JSON.stringify({ message: 'Method Not Allowed' })
    };
  }

  try {
    await connectToDatabase();
    
    const { email, password } = JSON.parse(event.body);

    const user = await User.findOne({ email });
    
    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: 'Invalid credentials' })
      };
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: 'Invalid credentials' })
      };
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      })
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Server error',
        error: error.message
      })
    };
  }
};
