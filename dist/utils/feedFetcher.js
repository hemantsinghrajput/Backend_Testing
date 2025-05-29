"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchFeeds = void 0;
const axios_1 = __importDefault(require("axios"));
const landingfeeds_1 = require("../landingfeeds");
const fetchFeeds = async () => {
    const results = {};
    const total = landingfeeds_1.landingFeeds.length;
    const partSize = Math.ceil(total / 3);
    const part1 = landingfeeds_1.landingFeeds.slice(0, partSize);
    const part2 = landingfeeds_1.landingFeeds.slice(partSize, partSize * 2);
    const part3 = landingfeeds_1.landingFeeds.slice(partSize * 2);
    const fetchPart = async (feeds) => {
        await Promise.all(feeds.map(async (feed) => {
            if (!feed.url) {
                console.warn(`No URL defined for feed: ${feed.key}`);
                return;
            }
            try {
                const url = `${feed.url}?t=${Math.floor(Date.now() / 60000)}`;
                const res = await axios_1.default.get(url);
                if (Array.isArray(res.data)) {
                    results[feed.key] = res.data;
                }
                else {
                    console.warn(`Unexpected data format from ${feed.key}:`, res.data);
                }
            }
            catch (error) {
                if (axios_1.default.isAxiosError(error)) {
                    console.warn(`Failed to fetch ${feed.key}:`, error.message);
                }
                else {
                    console.warn(`Unknown error fetching ${feed.key}:`, error);
                }
            }
        }));
    };
    // Fetch parts sequentially (safer), or in parallel if needed
    await fetchPart(part1);
    await fetchPart(part2);
    await fetchPart(part3);
    return results;
};
exports.fetchFeeds = fetchFeeds;
