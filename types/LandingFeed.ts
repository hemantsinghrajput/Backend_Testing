// types/LandingFeed.ts
import { Schema, Document, model } from 'mongoose';
import { Article } from './Article';

export interface LandingFeedDocument extends Document {
  key: string;
  articles: Article[];
  updatedAt: Date;
}

const LandingFeedSchema = new Schema<LandingFeedDocument>({
  key: { type: String, required: true, unique: true },
  articles: [{ type: Schema.Types.Mixed }], // Articles can have varying structures
  updatedAt: { type: Date, required: true },
}, { timestamps: true });

export const LandingFeed = model<LandingFeedDocument>('LandingFeed', LandingFeedSchema);

export type Feed = {
  key: string;
  path: string;
  priority: 'high' | 'medium' | 'low';
};