"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const LandingFeed_1 = __importDefault(require("../models/LandingFeed"));
const landingfeeds_1 = require("../landingfeeds");
const generatLandingPages_1 = require("../utils/generatLandingPages");
const categories_1 = require("../utils/categories");
const { gqlFetchAPI } = require('../lib/getFetchAPI');
const { GET_LATEST_NEWS } = require('../lib/query');
const router = (0, express_1.Router)();
const POST_CACHE_PATH = path_1.default.join(__dirname, '../data/post-cache.json');
let isProcessingPing = false;
let lastPingTime = 0;
// File I/O functions
const readPostCache = async () => {
    try {
        const content = await promises_1.default.readFile(POST_CACHE_PATH, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return [];
    }
};
const writePostCache = async (posts) => {
    await promises_1.default.writeFile(POST_CACHE_PATH, JSON.stringify(posts, null, 2));
};
// Checksum logic
const generateChecksum = (post) => {
    return crypto_1.default
        .createHash('md5')
        .update(post.slug + post.title + post.modified)
        .digest('hex');
};
const getNewOrUpdatedPosts = (latestPosts, cachedPosts) => {
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
        .filter((item) => item !== null);
};
// Async function to process ping logic
const processPing = async () => {
    console.log('📡 Processing ping');
    try {
        const latest = await gqlFetchAPI(GET_LATEST_NEWS);
        const latestPosts = latest?.posts?.nodes || [];
        const cachedPosts = await readPostCache();
        const changedPosts = getNewOrUpdatedPosts(latestPosts, cachedPosts);
        const updatedCategories = new Set();
        for (const { post } of changedPosts) {
            for (const cat of post.categories?.nodes || []) {
                const key = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                updatedCategories.add(key);
            }
        }
        for (const feed of landingfeeds_1.landingFeeds) {
            if (!updatedCategories.has(feed.key))
                continue;
            try {
                const url = `${feed.url}?t=${Math.floor(Date.now())}`;
                const res = await axios_1.default.get(url);
                if (Array.isArray(res.data)) {
                    await LandingFeed_1.default.findOneAndUpdate({ key: feed.key }, { articles: res.data, updatedAt: new Date() }, { upsert: true });
                    console.log(`📝 Updated feed: ${feed.key}`);
                }
            }
            catch (err) {
                console.warn(`⚠️ Failed to update ${feed.key}:`, err.message);
            }
        }
        // Save to file
        await writePostCache(latestPosts);
        console.log('📝 Updated post cache in JSON file');
        // Generate landing pages
        if (updatedCategories.size > 0) {
            const updatedParentTitles = new Set();
            const reverseMapping = {};
            Object.entries(categories_1.categoryMapping).forEach(([displayName, key]) => {
                reverseMapping[key] = displayName;
            });
            for (const updatedKey of updatedCategories) {
                const displayName = reverseMapping[updatedKey];
                if (displayName) {
                    const parentCategory = categories_1.categories.find(cat => cat.subcategories.some(sub => sub.toUpperCase() === displayName.toUpperCase()));
                    if (parentCategory) {
                        updatedParentTitles.add(parentCategory);
                    }
                }
            }
            const homeCategory = categories_1.categories.find(cat => cat.title.toUpperCase() === 'HOME');
            if (homeCategory) {
                updatedParentTitles.add(homeCategory);
            }
            if (updatedParentTitles.size > 0) {
                const updatedArray = Array.from(updatedParentTitles);
                await (0, generatLandingPages_1.generateLandingByCategoryGroup)(updatedArray);
                console.log(`📄 Generated landing pages for: ${updatedArray.map(cat => cat.title).join(', ')}`);
            }
        }
        console.log(`✅ Processed ping: ${updatedCategories.size} categories updated`);
    }
    catch (error) {
        console.error('❌ Ping processing error:', error);
    }
    finally {
        isProcessingPing = false;
    }
};
// /ping route
router.post('/ping', async (_req, res) => {
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
router.get('/category/:key', async (req, res) => {
    const key = req.params.key;
    try {
        const doc = await LandingFeed_1.default.findOne({ key }).lean();
        if (!doc)
            throw new Error('Not found');
        res.json(doc.articles);
    }
    catch (err) {
        res.status(404).json({ error: `Category '${key}' not found` });
    }
});
// /fetch-all (unchanged)
router.get('/fetch-all', async (_req, res) => {
    try {
        for (const feed of landingfeeds_1.landingFeeds) {
            const url = `${feed.url}?t=${Math.floor(Date.now() / 60000)}`;
            const resData = await axios_1.default.get(url);
            if (Array.isArray(resData.data)) {
                await LandingFeed_1.default.findOneAndUpdate({ key: feed.key }, { articles: resData.data, updatedAt: new Date() }, { upsert: true });
                console.log(`📝 Updated feed: ${feed.key}`);
            }
        }
        await (0, generatLandingPages_1.generateLandingByCategoryGroup)(categories_1.categories);
        res.json({ status: 'success', message: 'All feeds fetched and landing pages generated.' });
    }
    catch (err) {
        console.error('❌ Error fetching all feeds:', err);
        res.status(500).json({ error: 'Failed to fetch all feeds' });
    }
});
exports.default = router;
