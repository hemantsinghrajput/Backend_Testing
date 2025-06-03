import { Router, Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { landingFeeds } from '../landingfeeds';
import { generateLandingByCategoryGroup } from '../utils/generatLandingPages';
import { categories } from '../utils/categories';

// Load environment variables
import 'dotenv/config';

// Use CommonJS require for firebase-admin
const admin = require('firebase-admin');
const { gqlFetchAPI } = require('../lib/getFetchAPI');
const { GET_LATEST_NEWS } = require('../lib/query');

// Initialize Firebase Admin SDK with error handling
let serviceAccount: any;
const base64Config = process.env.FIREBASE_CONFIG_BASE64;

if (!base64Config) {
  throw new Error('Missing FIREBASE_CONFIG_BASE64 in environment');
}

serviceAccount = JSON.parse(Buffer.from(base64Config, 'base64').toString('utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const router = Router();

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

// File-based I/O functions
const dataDir = path.join(__dirname, '..', 'data');
const postCacheFile = path.join(dataDir, 'postCache.json');
const landingFeedFile = path.join(dataDir, 'landingFeed.json');

const ensureDataDir = async () => {
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    console.error('❌ Error creating data directory:', error);
  }
};

const readPostCache = async (): Promise<any[]> => {
  try {
    await ensureDataDir();
    const data = await fs.readFile(postCacheFile, 'utf8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('ℹ️ Post cache file not found, returning empty array');
      return [];
    }
    console.error('❌ Error reading post cache file:', error);
    return [];
  }
};

const writePostCache = async (posts: any[]) => {
  try {
    await ensureDataDir();
    const formattedPosts = posts.map(post => ({
      slug: post.slug,
      title: post.title,
      modified: post.modified,
      checksum: generateChecksum(post),
      categories: post.categories?.nodes?.map((c: any) => c.name) || [],
      date: post.date,
    }));
    await fs.writeFile(postCacheFile, JSON.stringify(formattedPosts, null, 2), 'utf8');
    console.log('📝 Successfully wrote to post cache file');
  } catch (error) {
    console.error('❌ Error writing to post cache file:', error);
  }
};

const readLandingFeed = async (): Promise<any[]> => {
  try {
    await ensureDataDir();
    const data = await fs.readFile(landingFeedFile, 'utf8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('ℹ️ Landing feed file not found, returning empty array');
      return [];
    }
    console.error('❌ Error reading landing feed file:', error);
    return [];
  }
};

const writeLandingFeed = async (key: string, articles: any[], updatedAt: Date) => {
  try {
    await ensureDataDir();
    const existingFeeds = await readLandingFeed();
    const updatedFeeds = existingFeeds.filter(feed => feed.key !== key);
    updatedFeeds.push({ key, articles, updatedAt });
    await fs.writeFile(landingFeedFile, JSON.stringify(updatedFeeds, null, 2), 'utf8');
    console.log(`📝 Successfully wrote to landing feed file for key: ${key}`);
    return { key, articles, updatedAt };
  } catch (error) {
    console.error(`❌ Error writing to landing feed file for key ${key}:`, error);
    return null;
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
  const cacheMap = new Map(cachedPosts.map(p => [p.slug, p.checksum]));
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
      console.warn(`⚠️ Retry ${i + 1}/${retries} failed: ${(err as any).message}`);
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
    console.log("latest", latest?.posts?.nodes);
    const latestPosts = latest?.posts?.nodes || [];
    const cachedPosts = await readPostCache();

    const changedPosts = getNewOrUpdatedPosts(latestPosts, cachedPosts);
    const updatedCategories = new Set<string>();

    // Process notifications and collect updated categories
    for (const { post, isNew } of changedPosts) {
      const postCategories = post.categories?.nodes?.map((c: any) => c.name) || [];
      const matchedTopics = getMatchingTopics(postCategories);
      const typeLabel = isNew ? '🆕 New' : '♻️ Updated';

      // Send notifications for matched topics
      for (const topic of matchedTopics) {
        try {
          await sendNotification(post, topic, postCategories, typeLabel);
        } catch (err) {
          console.error(`❌ Failed to notify topic ${topic}:`, err);
        }
      }

      // Schedule silent ping notification
      setTimeout(() => {
        sendNotificationPing(post, 'ping', postCategories).catch(err => {
          console.error(`❌ Failed ping after delay: ${post.slug}`, err);
        });
      }, 50000);

      // Collect updated categories for landing page generation
      for (const cat of postCategories) {
        const normalized = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const finalKey = normalized === 'highlight' ? 'headlines' : normalized;
        updatedCategories.add(finalKey);
      }
    }

    if (!changedPosts.length) {
      console.log("ℹ️ No new or modified posts.");
    }

    // Log updated categories for debugging
    console.log(`🔍 Updated categories: ${Array.from(updatedCategories).join(', ')}`);

    // Verify landingFeeds contains the updated categories
    const missingFeeds = Array.from(updatedCategories).filter(
      key => !landingFeeds.some(feed => feed.key === key)
    );
    if (missingFeeds.length > 0) {
      console.warn(`⚠️ Missing feeds for categories: ${missingFeeds.join(', ')}`);
    }

    // Update feeds for changed categories with retry logic
    for (const feed of landingFeeds) {
      if (!updatedCategories.has(feed.key)) continue;

      try {
        const url = `${feed.url}?t=${Math.floor(Date.now())}`;
        console.log(`🌐 Fetching feed for ${feed.key}: ${url}`);
        const res = await retry(() => axios.get(url), 3, 1000);

        if (Array.isArray(res.data)) {
          const updateResult = await writeLandingFeed(feed.key, res.data, new Date());
          if (updateResult) {
            console.log(`📝 Updated feed: ${feed.key} with ${res.data.length} articles`);
            console.log(`📝 LandingFeed update result: ${JSON.stringify({ key: updateResult.key, articleCount: updateResult.articles.length, updatedAt: updateResult.updatedAt }, null, 2)}`);
          } else {
            console.warn(`⚠️ Failed to update landing feed for ${feed.key}`);
          }
        } else {
          console.warn(`⚠️ Feed data for ${feed.key} is not an array: ${typeof res.data}`);
        }
      } catch (err) {
        console.error(`❌ Failed to update feed ${feed.key}:`, (err as any).message);
      }
    }

    // Save to JSON file
    await writePostCache(latestPosts);
    console.log('📝 Updated post cache in JSON file');

    // Generate landing pages
    if (updatedCategories.size > 0) {
      const updatedParentTitles = new Set<any>();

      // Check each updated category against titles and subcategories
      for (const updatedKey of updatedCategories) {
        const originalCat = updatedKey === 'headlines' ? 'Highlight' : updatedKey.replace(/-/g, ' ');
        console.log(`🔍 Processing category: ${originalCat} (normalized: ${updatedKey})`);

        // Find matching categories where the originalCat matches title or subcategory
        const matchingCategories = categories.filter(cat =>
          cat.title.toLowerCase() === originalCat.toLowerCase() ||
          cat.subcategories.some(sub => sub.toLowerCase() === originalCat.toLowerCase())
        );

        if (matchingCategories.length > 0) {
          matchingCategories.forEach(cat => {
            console.log(`🔍 Found matching category for ${originalCat}: ${cat.title}`);
            updatedParentTitles.add(cat);
          });
        } else {
          console.warn(`⚠️ No matching category found for ${originalCat}`);
        }
      }

      // Explicitly add Home for Highlight and Berita for Top BM or Super BM
      const homeCategory = categories.find(cat => cat.title.toUpperCase() === 'HOME');
      if (homeCategory && updatedCategories.has('headlines')) {
        console.log(`🔍 Adding Home category due to Highlight update`);
        updatedParentTitles.add(homeCategory);
      }
      const beritaCategory = categories.find(cat => cat.title.toUpperCase() === 'BERITA');
      if (beritaCategory && (updatedCategories.has('top-bm') || updatedCategories.has('super-bm'))) {
        console.log(`🔍 Adding Berita category due to Top BM or Super BM update`);
        updatedParentTitles.add(beritaCategory);
      }

      if (updatedParentTitles.size > 0) {
        const updatedArray = Array.from(updatedParentTitles);
        console.log(`🔍 Generating landing pages for categories: ${updatedArray.map(cat => cat.title).join(', ')}`);
        await generateLandingByCategoryGroup(updatedArray);
        console.log(`📄 Generated landing pages for: ${updatedArray.map(cat => cat.title).join(', ')}`);
      } else {
        console.log('ℹ️ No parent categories to generate landing pages for');
      }
    } else {
      console.log('ℹ️ No categories updated, skipping landing page generation');
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
    const feeds = await readLandingFeed();
    const doc = feeds.find(feed => feed.key === key);
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
      console.log(`🌐 Fetching feed for ${feed.key}: ${url}`);
      const resData = await retry(() => axios.get(url), 3, 1000);

      if (Array.isArray(resData.data)) {
        const updateResult = await writeLandingFeed(feed.key, resData.data, new Date());
        if (updateResult) {
          console.log(`📝 Updated feed: ${feed.key} with ${resData.data.length} articles`);
          console.log(`📝 LandingFeed update result: ${JSON.stringify({ key: updateResult.key, articleCount: updateResult.articles.length, updatedAt: updateResult.updatedAt }, null, 2)}`);
        } else {
          console.warn(`⚠️ Failed to update landing feed for ${feed.key}`);
        }
      } else {
        console.warn(`⚠️ Feed data for ${feed.key} is not an array: ${typeof resData.data}`);
      }
    }

    console.log(`🔍 Generating landing pages for all categories`);
    await generateLandingByCategoryGroup(categories);
    console.log(`📄 Generated landing pages for all categories`);

    res.json({ status: 'success', message: 'All feeds fetched and landing pages generated.' });
  } catch (err) {
    console.error('❌ Error fetching all feeds:', err);
    res.status(500).json({ error: 'Failed to fetch all feeds' });
  }
});

export default router;