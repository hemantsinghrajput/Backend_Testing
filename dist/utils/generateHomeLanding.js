"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLandingByCategoryGroup = void 0;
const LandingFeed_1 = __importDefault(require("../models/LandingFeed"));
const categories_1 = require("./categories");
// ✅ New utility to get N unique articles by slug
const getNUniqueArticles = (articles, count, seenSlugs) => {
    const result = [];
    for (const item of articles) {
        const slug = item.slug || item.permalink?.split('/').filter(Boolean).pop();
        if (!slug || seenSlugs.has(slug))
            continue;
        seenSlugs.add(slug);
        result.push(item);
        if (result.length === count)
            break;
    }
    return result;
};
const markFeaturedInSections = (items) => {
    const result = [];
    let inSection = false;
    let count = 0;
    for (const item of items) {
        if (item.type === 'CARD_TITLE') {
            inSection = true;
            count = 0;
            result.push(item);
            continue;
        }
        if (['MORE_ITEM', 'AD_ITEM'].includes(item.type)) {
            inSection = false;
            result.push(item);
            continue;
        }
        if (inSection) {
            item.type = count === 0 ? 'featured' : 'standard';
            count++;
        }
        else if (!item.type) {
            item.type = result.length === 0 || result[result.length - 1].type === 'CARD_TITLE'
                ? 'featured'
                : 'standard';
        }
        result.push(item);
    }
    return result;
};
const getCategoryArticles = async (key) => {
    try {
        const doc = await LandingFeed_1.default.findOne({ key }).lean();
        if (!doc || !Array.isArray(doc.articles))
            return [];
        return doc.articles;
    }
    catch (err) {
        console.warn(`⚠️ Could not fetch MongoDB articles for key: ${key}`, err);
        return [];
    }
};
const generateLandingByCategoryGroup = async (categories) => {
    const seenSlugs = new Set();
    for (const cat of categories) {
        const mainKey = categories_1.categoryMapping[cat.title.toUpperCase()];
        if (!mainKey) {
            console.warn(`⚠️ No mapping for category: ${cat.title}`);
            continue;
        }
        seenSlugs.clear();
        const isWorldOrProperty = ['WORLD', 'PROPERTY'].includes(cat.title.toUpperCase());
        if (isWorldOrProperty) {
            const mainArticles = await getCategoryArticles(mainKey);
            const selectedArticles = getNUniqueArticles(mainArticles, 30, seenSlugs);
            const result = [];
            for (let i = 0; i < selectedArticles.length; i++) {
                result.push(selectedArticles[i]);
                if ((i + 1) % 5 === 0 && i < selectedArticles.length - 1) {
                    result.push({ type: 'AD_ITEM' });
                }
            }
            const finalResult = markFeaturedInSections(result);
            await LandingFeed_1.default.findOneAndUpdate({ key: `${mainKey}-landing` }, { articles: finalResult, updatedAt: new Date() }, { upsert: true });
            continue;
        }
        const isHomeCategory = cat.title.toUpperCase() === 'HOME';
        if (isHomeCategory) {
            const result = [];
            const superHighlightArticles = await getCategoryArticles('super-highlight');
            if (superHighlightArticles.length > 0) {
                const first = superHighlightArticles[0];
                const slug = first.slug || first.permalink?.split('/').filter(Boolean).pop();
                if (slug) {
                    seenSlugs.add(slug);
                    result.push(first);
                }
            }
            const headlinesArticles = await getCategoryArticles('headlines');
            const remainingHeadlines = getNUniqueArticles(headlinesArticles, 4, seenSlugs);
            result.push(...remainingHeadlines);
            result.push({ title: 'Home', permalink: `json/app/list/headlines.json`, type: 'MORE_ITEM' });
            result.push({ type: 'AD_ITEM' });
            for (const sub of cat.subcategories) {
                const subKey = categories_1.categoryMapping[sub.toUpperCase()];
                if (!subKey) {
                    console.warn(`⚠️ No mapping for subcategory: ${sub}`);
                    continue;
                }
                const subArticles = await getCategoryArticles(subKey);
                const filtered = getNUniqueArticles(subArticles, 6, seenSlugs);
                if (filtered.length === 0)
                    continue;
                result.push({ title: sub, permalink: `json/app/list/${subKey}.json`, type: 'CARD_TITLE' });
                result.push(...filtered);
                result.push({ title: sub, permalink: `json/app/list/${subKey}.json`, type: 'MORE_ITEM' });
                result.push({ type: 'AD_ITEM' });
            }
            const finalResult = markFeaturedInSections(result);
            await LandingFeed_1.default.findOneAndUpdate({ key: `${mainKey}-landing` }, { articles: finalResult, updatedAt: new Date() }, { upsert: true });
            continue;
        }
        const mainArticles = await getCategoryArticles(mainKey);
        const mainSelected = getNUniqueArticles(mainArticles, 5, seenSlugs);
        const result = [...mainSelected];
        result.push({ title: cat.title, permalink: `json/app/list/${mainKey}.json`, type: 'MORE_ITEM' });
        result.push({ type: 'AD_ITEM' });
        for (const sub of cat.subcategories) {
            const subKey = categories_1.categoryMapping[sub.toUpperCase()];
            if (!subKey) {
                console.warn(`⚠️ No mapping for subcategory: ${sub}`);
                continue;
            }
            const subArticles = await getCategoryArticles(subKey);
            const filtered = getNUniqueArticles(subArticles, 6, seenSlugs);
            if (filtered.length === 0)
                continue;
            result.push({ title: sub, permalink: `json/app/list/${subKey}.json`, type: 'CARD_TITLE' });
            result.push(...filtered);
            result.push({ title: sub, permalink: `json/app/list/${subKey}.json`, type: 'MORE_ITEM' });
            result.push({ type: 'AD_ITEM' });
        }
        const finalResult = markFeaturedInSections(result);
        await LandingFeed_1.default.findOneAndUpdate({ key: `${mainKey}-landing` }, { articles: finalResult, updatedAt: new Date() }, { upsert: true });
    }
};
exports.generateLandingByCategoryGroup = generateLandingByCategoryGroup;
