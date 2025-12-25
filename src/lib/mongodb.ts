import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI as string;
const MONGODB_DB = process.env.MONGODB_DB;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

// Set mongoose options globally
mongoose.set('strictQuery', true);

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * Connect to MongoDB database with error handling and connection management
 * @returns Mongoose connection instance
 */
async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds instead of 30
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      maxPoolSize: 10, // Maintain up to 10 socket connections
    };

    console.log('Connecting to MongoDB...');
    const startTime = Date.now();
    
    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongoose) => {
        const connectionTime = Date.now() - startTime;
        console.log(`MongoDB connected successfully in ${connectionTime}ms`);
        
        // Log when the connection is closed
        mongoose.connection.on('disconnected', () => {
          console.log('MongoDB disconnected');
          cached.conn = null;
        });
        
        // Log connection errors
        mongoose.connection.on('error', (err) => {
          console.error('MongoDB connection error:', err);
        });
        
        return mongoose;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('MongoDB connection failed:', e);
    throw e;
  }

  return cached.conn;
}

export default connectToDatabase;
