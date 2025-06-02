import { Router, Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import LandingFeed from '../models/LandingFeed';
import { landingFeeds } from '../landingfeeds';
import { generateLandingByCategoryGroup } from '../utils/generatLandingPages';
import { categories, categoryMapping } from '../utils/categories';

// Load environment variables
import 'dotenv/config';

// Use CommonJS require for firebase-admin
const admin = require('firebase-admin');
const { gqlFetchAPI } = require('../lib/getFetchAPI');
const { GET_LATEST_NEWS } = require('../lib/query');

// Initialize Firebase Admin SDK with error handling
let serviceAccount: any;
try {
  // Use path.join for robust path resolution
  const base64Config = process.env.FIREBASE_CONFIG_BASE64;

  if (!base64Config) {
    throw new Error('Missing FIREBASE_CONFIG_BASE64 in environment');
  }
  
  const serviceAccount = JSON.parse(Buffer.from(base64Config, 'base64').toString('utf8'));
  } catch (error:any) {
  console.error('❌ Error loading firebase-service-account.json:', error.message);
  throw new Error('Firebase service account file is missing or invalid. Please ensure firebase-service-account.json exists in the project root.');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const router = Router();

const POST_CACHE_PATH = path.join(__dirname, '../data/post-cache.json');
let isProcessingPing = false;
let lastPingTime = 0;

// Topic mapping for notifications
const topicMappings = {
  breakingNews: ['Highlight', 'Malaysia', 'Super Highlight', 'Top News', 'Top World'],
  beritaUtama: ['Tempatan', 'Top BM'],
  topOpinion: ['Top Opinion'],
  topLifestyle: ['Top Lifestyle'],
  topBusiness: ['Top Business', 'World Business'],
  topSports: ['Top Sports'],
};

const enabledTopics = [
  { topic: 'breakingNews', enabled: true },
  { topic: 'beritaUtama', enabled: true },
  { topic: 'topOpinion', enabled: true },
  { topic: 'topLifestyle', enabled: true },
  { topic: 'topBusiness', enabled: true },
  { topic: 'topSports', enabled: true },
];

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

// Notification helper functions
const getMatchingTopics = (categories: string[]) => {
  return enabledTopics
    .filter(({ enabled, topic }) => 
      enabled && topicMappings[topic as keyof typeof topicMappings]?.some(cat => categories.includes(cat))
    )
    .map(({ topic }) => topic);
};

const retry = async (fn: () => Promise<any>, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`⚠️ Retry ${i + 1}/${retries} failed`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
};

const sendNotification = async (post: any, topic: string, categories: string[], typeLabel = '🆕 New') => {
  const category = post.categories?.nodes?.[0]?.name || 'News';
  const bodyText = typeLabel.includes('Updated')
    ? `♻️ This post has been updated - ${category} - ${new Date(post.modified).toDateString()}`
    : `${category} - ${new Date(post.date).toDateString()}`;

  const message = {
    notification: {
      title: `${typeLabel}: ${post.title}`,
      body: bodyText,
    },
    data: {
      slug: post.slug,
      date: post.modified,
      categories: JSON.stringify(categories),
      topic,
      isUpdate: typeLabel.includes('Updated') ? 'true' : 'false',
    },
    topic,
  };

  await retry(() => admin.messaging().send(message));
  console.log(JSON.stringify({
    event: 'notification_sent',
    type: typeLabel.includes('Updated') ? 'update' : 'new',
    title: post.title,
    slug: post.slug,
    topic,
    modified: post.modified,
    categories,
  }));
};

const sendNotificationPing = async (post: any, topic: string, categories: string[]) => {
  const message = {
    data: {
      slug: post.slug,
      date: post.modified,
      categories: JSON.stringify(categories),
      topic,
      isPing: 'true',
    },
    topic,
  };
  await retry(() => admin.messaging().send(message));
  console.log(`📨 Silent ping sent to topic: ${topic}`);
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

    // Process notifications and collect updated categories
    for (const { post, isNew } of changedPosts) {
      const categories = post.categories?.nodes?.map((c: any) => c.name) || [];
      const matchedTopics = getMatchingTopics(categories);
      const typeLabel = isNew ? '🆕 New' : '♻️ Updated';

      // Send notifications for matched topics
      for (const topic of matchedTopics) {
        try {
          await sendNotification(post, topic, categories, typeLabel);
        } catch (err) {
          console.error(`❌ Failed to notify topic ${topic}:`, err);
        }
      }

      // Schedule silent ping notification
      setTimeout(() => {
        sendNotificationPing(post, 'ping', categories).catch(err => {
          console.error(`❌ Failed ping after delay: ${post.slug}`, err);
        });
      }, 50000);

      // Collect updated categories for landing page generation
      for (const cat of categories) {
        const key = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        updatedCategories.add(key);
      }
    }

    if (!changedPosts.length) {
      console.log("ℹ️ No new or modified posts.");
    }

    // Update feeds for changed categories
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
        console.log(updatedArray);
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

// /category/:key
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

// /fetch-all
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