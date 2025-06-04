// models/PostCache.ts
import { Schema, Document, model } from 'mongoose';

export interface PostCacheDocument extends Document {
  slug: string;
  title: string;
  modified: string;
  checksum: string;
  categories: string[];
  date: string;
}

const PostCacheSchema = new Schema<PostCacheDocument>({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  modified: { type: String, required: true },
  checksum: { type: String, required: true },
  categories: [{ type: String }],
  date: { type: String, required: true },
}, { timestamps: true });

export const PostCache = model<PostCacheDocument>('PostCache', PostCacheSchema);