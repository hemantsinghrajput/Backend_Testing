import { Router, Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import LandingFeed from '../models/LandingFeed';
import { landingFeeds } from '../landingfeeds';
import { generateLandingByCategoryGroup } from '../utils/generateHomeLanding';
import { categories, categoryMapping } from '../utils/categories';

const { gqlFetchAPI } = require('../notification/getFetchAPI');
const { GET_LATEST_NEWS } = require('../notification/query');

const router = Router();

const POST_CACHE_PATH = path.join(__dirname, '../data/post-cache.json');

// ✅ File I/O functions
const readPostCache = async (): Promise<any[]> => {
  try {
    const content = await fs.readFile(POST_CACHE_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
};

const writePostCache = async (posts: any[]) => {
  await fs.writeFile(POST_CACHE_PATH, JSON.stringify(posts, null, 2));
};

// ✅ Checksum logic
const generateChecksum = (post: any): string => {
  return crypto
    .createHash('md5')
    .update(post.slug + post.title + post.modified)
    .digest('hex');
};

const getNewOrUpdatedPosts = (latestPosts: any[], cachedPosts: any[]) => {
  const cacheMap = new Map(cachedPosts.map(p => [p.slug, generateChecksum(p)]));
  return latestPosts
    .map(post => {
      const checksum = generateChecksum(post);
      const isModified = cacheMap.has(post.slug) && cacheMap.get(post.slug) !== checksum;
      const isNew = !cacheMap.has(post.slug);
      if (isNew || isModified) {
        return { post, isNew };
      }
      return null;
    })
    .filter((item): item is { post: any; isNew: boolean } => item !== null);
};

// ✅ /ping route
router.get('/ping', async (_req: Request, res: Response) => {
  console.log('📡 /ping called');

  try {
    const latest = await gqlFetchAPI(GET_LATEST_NEWS);
    const latestPosts = latest?.posts?.nodes || [];
    const cachedPosts = await readPostCache();

    const changedPosts = getNewOrUpdatedPosts(latestPosts, cachedPosts);
    const updatedCategories = new Set<string>();

    for (const { post } of changedPosts) {
      for (const cat of post.categories?.nodes || []) {
        const key = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        updatedCategories.add(key);
      }
    }

    for (const feed of landingFeeds) {
      if (!updatedCategories.has(feed.key)) continue;

      try {
        const url = `${feed.url}?t=${Math.floor(Date.now())}`;
        const res = await axios.get(url);
        if (Array.isArray(res.data)) {
          await LandingFeed.findOneAndUpdate(
            { key: feed.key },
            { articles: res.data, updatedAt: new Date() },
            { upsert: true }
          );
          console.log(`📝 Updated feed: ${feed.key}`);
        }
      } catch (err) {
        console.warn(`⚠️ Failed to update ${feed.key}:`, (err as any).message);
      }
    }

    // ✅ Save to file instead of Mongo
    await writePostCache(latestPosts);
    console.log('📝 Updated post cache in JSON file');

    // Generate landing pages
    if (updatedCategories.size > 0) {
      const updatedParentTitles = new Set<any>();
      const reverseMapping: Record<string, string> = {};
      Object.entries(categoryMapping).forEach(([displayName, key]) => {
        reverseMapping[key] = displayName;
      });

      for (const updatedKey of updatedCategories) {
        const displayName = reverseMapping[updatedKey];
        if (displayName) {
          const parentCategory = categories.find(cat =>
            cat.subcategories.some(sub =>
              sub.toUpperCase() === displayName.toUpperCase()
            )
          );
          if (parentCategory) {
            updatedParentTitles.add(parentCategory);
          }
        }
      }

      const homeCategory = categories.find(cat => cat.title.toUpperCase() === 'HOME');
      if (homeCategory) {
        updatedParentTitles.add(homeCategory);
      }

      if (updatedParentTitles.size > 0) {
        const updatedArray = Array.from(updatedParentTitles);
        await generateLandingByCategoryGroup(updatedArray);
        console.log(`📄 Generated landing pages for: ${updatedArray.map(cat => cat.title).join(', ')}`);
      }
    }

    res.json({
      status: 'success',
      updatedKeys: Array.from(updatedCategories),
      message: `Processed ${updatedCategories.size} updated categories successfully`,
    });
  } catch (error) {
    console.error('❌ Ping error:', error);
    res.status(500).json({ error: 'Failed to process ping' });
  }
});

// ✅ /category/:key (unchanged)
router.get('/category/:key', async (req: Request<{ key: string }>, res: Response) => {
  const key = req.params.key;
  try {
    const doc = await LandingFeed.findOne({ key }).lean();
    if (!doc) throw new Error('Not found');
    res.json(doc.articles);
  } catch (err) {
    res.status(404).json({ error: `Category '${key}' not found` });
  }
});

// ✅ /fetch-all (unchanged)
router.get('/fetch-all', async (_req: Request, res: Response) => {
  try {
    for (const feed of landingFeeds) {
      const url = `${feed.url}?t=${Math.floor(Date.now() / 60000)}`;
      const resData = await axios.get(url);

      if (Array.isArray(resData.data)) {
        await LandingFeed.findOneAndUpdate(
          { key: feed.key },
          { articles: resData.data, updatedAt: new Date() },
          { upsert: true }
        );
        console.log(`📝 Updated feed: ${feed.key}`);
      }
    }

    await generateLandingByCategoryGroup(categories);

    res.json({ status: 'success', message: 'All feeds fetched and landing pages generated.' });
  } catch (err) {
    console.error('❌ Error fetching all feeds:', err);
    res.status(500).json({ error: 'Failed to fetch all feeds' });
  }
});

export default router;
