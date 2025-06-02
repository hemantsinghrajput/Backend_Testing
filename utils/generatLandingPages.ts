import LandingFeed from '../models/LandingFeed';
import { Article } from '../types/Article';
import { categoryMapping } from './categories';

const customKeyMap: Record<string, string> = {
  'headlines-landing': 'home-landing',
  'top-news-landing': 'news-landing',
  'berita-utama-landing': 'berita-landing',
  'fmt-news-landing': 'videos-landing',
};

// ✅ New utility to get N unique articles by slug
const getNUniqueArticles = (
  articles: Article[],
  count: number,
  seenSlugs: Set<string>
): Article[] => {
  const result: Article[] = [];
  for (const item of articles) {
    const slug = item.slug || item.permalink?.split('/').filter(Boolean).pop();
    if (!slug || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    result.push(item);
    if (result.length === count) break;
  }
  return result;
};

// ✅ Utility to remove unnecessary fields for specific types
const cleanItemFields = (item: any): any => {
  if (['MORE_ITEM', 'AD_ITEM'].includes(item.type)) {
    const { tags, categories, 'related-articles': relatedArticles, ...cleanedItem } = item;
    return cleanedItem;
  }
  return item;
};

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

const getCategoryArticles = async (key: string): Promise<Article[]> => {
  try {
    const doc = await LandingFeed.findOne({ key }).lean();
    if (!doc || !Array.isArray(doc.articles)) return [];
    return doc.articles;
  } catch (err) {
    console.warn(`⚠️ Could not fetch MongoDB articles for key: ${key}`, err);
    return [];
  }
};

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

    seenSlugs.clear();
    const isWorldOrProperty = ['WORLD', 'PROPERTY'].includes(cat.title.toUpperCase());

    if (isWorldOrProperty) {
      const mainArticles = await getCategoryArticles(mainKey);
      const selectedArticles = getNUniqueArticles(mainArticles, 30, seenSlugs);

      const result: any[] = [];
      for (let i = 0; i < selectedArticles.length; i++) {
        result.push(selectedArticles[i]);
        if ((i + 1) % 5 === 0 && i < selectedArticles.length - 1) {
          result.push(cleanItemFields({ type: 'AD_ITEM' }));
        }
      }

      const finalResult = markFeaturedInSections(result);
      await LandingFeed.findOneAndUpdate(
        { key: `${mainKey}-landing` },
        { articles: finalResult, updatedAt: new Date() },
        { upsert: true }
      );
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
      console.log(mainKey);
      const key = customKeyMap[`${mainKey}-landing`] || `${mainKey}-landing`;

      await LandingFeed.findOneAndUpdate(
        { key: key },
        { articles: finalResult, updatedAt: new Date() },
        { upsert: true }
      );
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
    const key = customKeyMap[`${mainKey}-landing`] || `${mainKey}-landing`;
    console.log(mainKey);

    await LandingFeed.findOneAndUpdate(
      { key: key},
      { articles: finalResult, updatedAt: new Date() },
      { upsert: true }
    );
  }
};