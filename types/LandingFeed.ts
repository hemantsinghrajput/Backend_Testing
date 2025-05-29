
// types/LandingFeed.ts
import { Article } from './Article';

export interface LandingFeedDocument {
  key: string;
  articles: Article[];
  updatedAt: Date;
}
