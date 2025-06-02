import { Router, Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import LandingFeed from '../models/LandingFeed';
import { landingFeeds } from '../landingfeeds';
import { generateLandingByCategoryGroup } from '../utils/generatLandingPages';
import { categories, categoryMapping } from '../utils/categories';

const { gqlFetchAPI } = require('../lib/getFetchAPI');
const { GET_LATEST_NEWS } = require('../lib/query');

const router = Router();

const POST_CACHE_PATH = path.join(__dirname, '../data/post-cache.json');
let isProcessingPing = false;
let lastPingTime = 0;

// File I/O functions
const readPostCache = async (): Promise<any[]> => {
  try {
    const content = await fs.readFile(POST_CACHE_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
};

const writePostCache = async (posts: any[]) => {
  try {
    // Ensure the directory exists
    const dir = path.dirname(POST_CACHE_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(POST_CACHE_PATH, JSON.stringify(posts, null, 2));
    console.log('📝 Successfully wrote to post-cache.json');
  } catch (error) {
    console.error('❌ Error writing to post-cache.json:', error);
  }
};

// Checksum logic
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

// Async function to process ping logic
const processPing = async () => {
  console.log('📡 Processing ping');
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

    // Save to file
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

    console.log(`✅ Processed ping: ${updatedCategories.size} categories updated`);
  } catch (error) {
    console.error('❌ Ping processing error:', error);
  } finally {
    isProcessingPing = false;
  }
};

// /ping route
router.post('/ping', async (_req: Request, res: Response) => {
  const now = Date.now();
  if (isProcessingPing || now - lastPingTime < 2000) {
    return res.status(429).send('Ping already in progress or too frequent.');
  }

  isProcessingPing = true;
  lastPingTime = now;

  // Send immediate 200 response
  res.status(200).json({
    status: 'success',
    message: 'Ping received and being processed',
  });

  // Process ping asynchronously
  processPing();
});

// /category/:key (unchanged)
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

// /fetch-all (unchanged)
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