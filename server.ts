import express from 'express';
import mongoose from 'mongoose';
import serverless from 'serverless-http';
import feedRoutes from './routes/feeds';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use('/api', feedRoutes);

// Reuse MongoDB connection
let cachedDb: mongoose.Mongoose | null = null;

async function connectToDatabase() {
  if (cachedDb) {
    console.log('✅ Using cached MongoDB connection');
    return cachedDb;
  }

  try {
    const db = await mongoose.connect(process.env.MONGO_URI as string);
    console.log('✅ MongoDB connected');
    cachedDb = db;
    return db;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    throw err;
  }
}

// Initialize connection before handling requests
export const handler = async (event: any, context: any) => {
  context.callbackWaitsForEmptyEventLoop = false; // Prevent connection from closing
  await connectToDatabase();
  return serverless(app)(event, context);
};