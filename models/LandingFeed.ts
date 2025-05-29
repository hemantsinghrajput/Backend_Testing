// models/LandingFeed.ts
import mongoose, { Schema, model } from 'mongoose';
import { Article } from '../types/Article';
import { LandingFeedDocument } from '../types/LandingFeed';

const ArticleSchema = new Schema<Article>(
  {
    id: Number,
    title: String,
    permalink: String,
    content: String,
    excerpt: String,
    date: String,
    author: String,
    thumbnail: String,
    categories: [String],
    'featured-category': String,
    tags: [{ title: String, slug: String }],
    'related-articles': [{
      id: Number,
      title: String,
      permalink: String,
      excerpt: String,
      date: String,
      thumbnail: String,
      'dynamic-link': String,
    }],
    'dynamic-link': String,
    type: String,
  },
  { _id: false }
);

const LandingFeedSchema = new Schema<LandingFeedDocument>({
  key: { type: String, required: true, unique: true },
  articles: [ArticleSchema],
  updatedAt: { type: Date, default: Date.now },
});

export default model<LandingFeedDocument>('LandingFeed', LandingFeedSchema);
