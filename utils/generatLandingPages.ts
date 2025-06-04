import { LandingFeed } from '../types/LandingFeed';
import { Article } from '../types/Article';
import { categoryMapping } from './categories';

const customKeyMap: Record<string, string> = {
  'headlines-landing': 'home-landing',
  'top-news-landing': 'news-landing',
  'berita-utama-landing': 'berita-landing',
  'fmt-news-landing': 'videos-landing',
};

// Helper function to clean key by removing 'all-' prefix
const cleanLandingKey = (key: string): string => {
  if (key.startsWith('all-')) {
    const cleanedKey = key.replace(/^all-/, '');
    console.log(`🔍 Cleaned key from ${key} to ${cleanedKey}`);
    return cleanedKey;
  }
  return key;
};

// Utility to get N unique articles by slug
const getNUniqueArticles = (
  articles: Article[],
  count: number,
  seenSlugs: Set<string>
): Article[] => {
  const result: Article[] = [];
  for (const item of articles) {
    const slug = item.slug || item.permalink?.split('/').filter(Boolean).pop();
    if (!slug) {
      console.warn(`⚠️ Article missing slug/permalink:`, JSON.stringify(item));
      continue;
    }
    if (seenSlugs.has(slug)) {
      console.log(`🔄 Skipping duplicate slug: ${slug}`);
      continue;
    }
    seenSlugs.add(slug);
    result.push(item);
    if (result.length === count) break;
  }
  console.log(`✅ Selected ${result.length} unique articles`);
  return result;
};

// Utility to remove unnecessary fields for specific types
const cleanItemFields = (item: any): any => {
  if (['MORE_ITEM', 'AD_ITEM'].includes(item.type)) {
    const { tags, categories, 'related-articles': relatedArticles, ...cleanedItem } = item;
    return cleanedItem;
  }
  return item;
};

// Mark articles as featured or standard based on section
const markFeaturedInSections = (items: any[]): any[] => {
  const result: any[] = [];
  let inSection = false;
  let count = 0;

  for (const item of items) {
    if (item.type === 'CARD_TITLE') {
      inSection = true;
      count = 0;
      result.push(cleanItemFields(item));
      continue;
    }

    if (['MORE_ITEM', 'AD_ITEM'].includes(item.type)) {
      inSection = false;
      result.push(cleanItemFields(item));
      continue;
    }

    if (inSection) {
      item.type = count === 0 ? 'featured' : 'standard';
      count++;
    } else if (!item.type) {
      item.type = result.length === 0 || result[result.length - 1].type === 'CARD_TITLE'
        ? 'featured'
        : 'standard';
    }

    result.push(cleanItemFields(item));
  }

  return result;
};

// Fetch articles from MongoDB
const getCategoryArticles = async (key: string): Promise<Article[]> => {
  try {
    const doc = await LandingFeed.findOne({ key }).lean();
    if (!doc || !Array.isArray(doc.articles)) {
      console.warn(`⚠️ No articles found for key: ${key} in MongoDB`);
      return [];
    }
    console.log(`📄 Found ${doc.articles.length} articles for key: ${key}`);
    return doc.articles;
  } catch (err) {
    console.error(`❌ Error fetching articles for key: ${key}`, err);
    return [];
  }
};

// Write articles to MongoDB
const writeLandingFeed = async (key: string, articles: any[], updatedAt: Date) => {
  try {
    const updateResult = await LandingFeed.findOneAndUpdate(
      { key },
      { key, articles, updatedAt },
      { upsert: true, new: true }
    );
    console.log(`📝 Successfully wrote ${articles.length} articles to landing feed for key: ${key}`);
    return updateResult;
  } catch (error) {
    console.error(`❌ Error writing to landing feed for key ${key}:`, error);
    return null;
  }
};

// Main function to generate landing pages
export const generateLandingByCategoryGroup = async (
  categories: { id: number; title: string; subcategories: string[] }[]
) => {
  const seenSlugs = new Set<string>();

  for (const cat of categories) {
    const mainKey = categoryMapping[cat.title.toUpperCase()];
    if (!mainKey) {
      console.warn(`⚠️ No mapping for category: ${cat.title}`);
      continue;
    }

    console.log(`🔍 Processing category: ${cat.title} with mainKey: ${mainKey}`);
    seenSlugs.clear();
    const isWorldOrProperty = ['WORLD', 'PROPERTY'].includes(cat.title.toUpperCase());

    if (isWorldOrProperty) {
      const mainArticles = await getCategoryArticles(mainKey);
      console.log(`📚 Fetched ${mainArticles.length} articles for key: ${mainKey}`);

      if (mainArticles.length === 0) {
        console.warn(`⚠️ No articles returned for key: ${mainKey}. Check MongoDB data or query.`);
      }

      const selectedArticles = getNUniqueArticles(mainArticles, 30, seenSlugs);
      console.log(`✅ Selected ${selectedArticles.length} unique articles for ${cat.title}`);

      if (selectedArticles.length === 0) {
        console.warn(`⚠️ No unique articles selected for ${cat.title} landing page (key: ${mainKey}). Check slugs/permalinks.`);
      }

      const result: any[] = [];
      for (let i = 0; i < selectedArticles.length; i++) {
        result.push(selectedArticles[i]);
        if ((i + 1) % 5 === 0 && i < selectedArticles.length - 1) {
          result.push(cleanItemFields({ type: 'AD_ITEM' }));
        }
      }

      const finalResult = markFeaturedInSections(result);
      const landingKey = cleanLandingKey(customKeyMap[`${mainKey}-landing`] || `${mainKey}-landing`);
      console.log(`✍️ Writing ${finalResult.length} articles to landing key: ${landingKey}`);

      const writeResult = await writeLandingFeed(landingKey, finalResult, new Date());
      if (!writeResult) {
        console.error(`❌ Failed to write landing feed for key: ${landingKey}`);
      } else {
        console.log(`✅ Successfully wrote ${finalResult.length} articles to ${landingKey}`);
      }
      continue;
    }

    const isHomeCategory = cat.title.toUpperCase() === 'HOME';
    if (isHomeCategory) {
      const result: any[] = [];

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

      result.push(cleanItemFields({ title: 'Home', permalink: `api/category/headlines`, type: 'MORE_ITEM' }));
      result.push(cleanItemFields({ type: 'AD_ITEM' }));

      for (const sub of cat.subcategories) {
        const subKey = categoryMapping[sub.toUpperCase()];
        if (!subKey) {
          console.warn(`⚠️ No mapping for subcategory: ${sub}`);
          continue;
        }

        const subArticles = await getCategoryArticles(subKey);
        const filtered = getNUniqueArticles(subArticles, 6, seenSlugs);

        if (filtered.length === 0) continue;

        result.push({ title: sub, permalink: `api/category/${subKey}`, type: 'CARD_TITLE' });
        result.push(...filtered);
        result.push(cleanItemFields({ title: sub, permalink: `api/category/${subKey}`, type: 'MORE_ITEM' }));
        result.push(cleanItemFields({ type: 'AD_ITEM' }));
      }

      const finalResult = markFeaturedInSections(result);
      const landingKey = cleanLandingKey(customKeyMap[`${mainKey}-landing`] || `${mainKey}-landing`);
      console.log(`✍️ Writing ${finalResult.length} articles to landing key: ${landingKey}`);

      const writeResult = await writeLandingFeed(landingKey, finalResult, new Date());
      if (!writeResult) {
        console.error(`❌ Failed to write landing feed for key: ${landingKey}`);
      } else {
        console.log(`✅ Successfully wrote ${finalResult.length} articles to ${landingKey}`);
      }
      continue;
    }

    const mainArticles = await getCategoryArticles(mainKey);
    const mainSelected = getNUniqueArticles(mainArticles, 5, seenSlugs);

    const result: any[] = [...mainSelected];
    result.push(cleanItemFields({ title: cat.title, permalink: `api/category/${mainKey}`, type: 'MORE_ITEM' }));
    result.push(cleanItemFields({ type: 'AD_ITEM' }));

    for (const sub of cat.subcategories) {
      const subKey = categoryMapping[sub.toUpperCase()];
      if (!subKey) {
        console.warn(`⚠️ No mapping for subcategory: ${sub}`);
        continue;
      }

      const subArticles = await getCategoryArticles(subKey);
      const filtered = getNUniqueArticles(subArticles, 6, seenSlugs);

      if (filtered.length === 0) continue;

      result.push({ title: sub, permalink: `api/category/${subKey}`, type: 'CARD_TITLE' });
      result.push(...filtered);
      result.push(cleanItemFields({ title: sub, permalink: `api/category/${subKey}`, type: 'MORE_ITEM' }));
      result.push(cleanItemFields({ type: 'AD_ITEM' }));
    }

    const finalResult = markFeaturedInSections(result);
    const landingKey = cleanLandingKey(customKeyMap[`${mainKey}-landing`] || `${mainKey}-landing`);
    console.log(`✍️ Writing ${finalResult.length} articles to landing key: ${landingKey}`);

    const writeResult = await writeLandingFeed(landingKey, finalResult, new Date());
    if (!writeResult) {
      console.error(`❌ Failed to write landing feed for key: ${landingKey}`);
    } else {
      console.log(`✅ Successfully wrote ${finalResult.length} articles to ${landingKey}`);
    }
  }
};