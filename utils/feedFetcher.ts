import axios from 'axios';
import { Article } from '../types/Article';
import { landingFeeds } from '../landingfeeds';

export const fetchFeeds = async (): Promise<Record<string, Article[]>> => {
  const results: Record<string, Article[]> = {};

  const total = landingFeeds.length;
  const partSize = Math.ceil(total / 3);

  const part1 = landingFeeds.slice(0, partSize);
  const part2 = landingFeeds.slice(partSize, partSize * 2);
  const part3 = landingFeeds.slice(partSize * 2);

  const fetchPart = async (feeds: typeof landingFeeds) => {
    await Promise.all(
      feeds.map(async (feed) => {
        if (!feed.url) {
          console.warn(`No URL defined for feed: ${feed.key}`);
          return;
        }

        try {
          const url = `${feed.url}?t=${Math.floor(Date.now() / 60000)}`;
          const res = await axios.get<Article[]>(url);

          if (Array.isArray(res.data)) {
            results[feed.key] = res.data;
          } else {
            console.warn(`Unexpected data format from ${feed.key}:`, res.data);
          }
        } catch (error: unknown) {
          if (axios.isAxiosError(error)) {
            console.warn(`Failed to fetch ${feed.key}:`, error.message);
          } else {
            console.warn(`Unknown error fetching ${feed.key}:`, error);
          }
        }
      })
    );
  };

  // Fetch parts sequentially (safer), or in parallel if needed
  await fetchPart(part1);
  await fetchPart(part2);
  await fetchPart(part3);

  return results;
};
