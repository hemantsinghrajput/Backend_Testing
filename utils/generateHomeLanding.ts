import LandingFeed from '../models/LandingFeed';
import { Article } from '../types/Article';
import { categoryMapping } from './categories';

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

const markFeaturedInSections = (items: any[]): any[] => {
  const result: any[] = [];
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
    } else if (!item.type) {
      item.type = result.length === 0 || result[result.length - 1].type === 'CARD_TITLE'
        ? 'featured'
        : 'standard';
    }

    result.push(item);
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
          result.push({ type: 'AD_ITEM' });
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

      result.push({ title: 'Home', permalink: `json/app/list/headlines.json`, type: 'MORE_ITEM' });
      result.push({ type: 'AD_ITEM' });

      for (const sub of cat.subcategories) {
        const subKey = categoryMapping[sub.toUpperCase()];
        if (!subKey) {
          console.warn(`⚠️ No mapping for subcategory: ${sub}`);
          continue;
        }

        const subArticles = await getCategoryArticles(subKey);
        const filtered = getNUniqueArticles(subArticles, 6, seenSlugs);

        if (filtered.length === 0) continue;

        result.push({ title: sub, permalink: `json/app/list/${subKey}.json`, type: 'CARD_TITLE' });
        result.push(...filtered);
        result.push({ title: sub, permalink: `json/app/list/${subKey}.json`, type: 'MORE_ITEM' });
        result.push({ type: 'AD_ITEM' });
      }

      const finalResult = markFeaturedInSections(result);
      await LandingFeed.findOneAndUpdate(
        { key: `${mainKey}-landing` },
        { articles: finalResult, updatedAt: new Date() },
        { upsert: true }
      );
      continue;
    }

    const mainArticles = await getCategoryArticles(mainKey);
    const mainSelected = getNUniqueArticles(mainArticles, 5, seenSlugs);

    const result: any[] = [...mainSelected];
    result.push({ title: cat.title, permalink: `json/app/list/${mainKey}.json`, type: 'MORE_ITEM' });
    result.push({ type: 'AD_ITEM' });

    for (const sub of cat.subcategories) {
      const subKey = categoryMapping[sub.toUpperCase()];
      if (!subKey) {
        console.warn(`⚠️ No mapping for subcategory: ${sub}`);
        continue;
      }

      const subArticles = await getCategoryArticles(subKey);
      const filtered = getNUniqueArticles(subArticles, 6, seenSlugs);

      if (filtered.length === 0) continue;

      result.push({ title: sub, permalink: `json/app/list/${subKey}.json`, type: 'CARD_TITLE' });
      result.push(...filtered);
      result.push({ title: sub, permalink: `json/app/list/${subKey}.json`, type: 'MORE_ITEM' });
      result.push({ type: 'AD_ITEM' });
    }

    const finalResult = markFeaturedInSections(result);
    await LandingFeed.findOneAndUpdate(
      { key: `${mainKey}-landing` },
      { articles: finalResult, updatedAt: new Date() },
      { upsert: true }
    );
  }
};
