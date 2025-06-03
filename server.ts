// server.ts
import express from 'express';
import serverless from 'serverless-http';
import feedRoutes from './routes/feeds';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api', feedRoutes);

let isConnected = false;
const connectToDatabase = async () => {
  if (!isConnected) {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log('✅ MongoDB connected');
    isConnected = true;
  }
};

const handler = serverless(app);

export default async function(req: any, res: any) {
  await connectToDatabase();
  return handler(req, res);
}
