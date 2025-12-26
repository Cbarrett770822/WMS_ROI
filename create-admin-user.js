// Script to create admin user
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./netlify/functions/models/User');

async function createAdminUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Create admin user
        const admin = await User.create({
            email: 'admin@wms.com',
            password: 'admin123',
            name: 'Admin User',
            role: 'admin'
        });
        console.log('Admin user created:', admin.email);

        // Create regular user
        const user = await User.create({
            email: 'user@wms.com',
            password: 'user123',
            name: 'Regular User',
            role: 'user'
        });
        console.log('Regular user created:', user.email);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

createAdminUser();
