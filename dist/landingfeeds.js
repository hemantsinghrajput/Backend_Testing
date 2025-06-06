"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.landingFeeds = void 0;
const CMS_BASE = 'https://staging-cms.freemalaysiatoday.com';
const S3_BASE = 'https://s3feed.freemalaysiatoday.com';
exports.landingFeeds = [
    { key: 'super-highlight', url: `${CMS_BASE}/category/category/super-highlight/feed/json/app/` },
    { key: 'headlines', url: `${CMS_BASE}/category/category/highlight/feed/json/app/` },
    { key: 'top-news', url: `${CMS_BASE}/category/category/top-news/feed/json/app/` },
    { key: 'news', url: `${CMS_BASE}/category/category/nation/feed/json/app/` },
    { key: 'berita', url: `${CMS_BASE}/category/category/top-bm/feed/json/app/` },
    { key: 'all-berita', url: `${CMS_BASE}/category/category/bahasa/feed/json/app/` },
    { key: 'opinion', url: `${CMS_BASE}/category/category/top-opinion/feed/json/app/` },
    { key: 'all-opinion', url: `${CMS_BASE}/category/category/opinion/feed/json/app/` },
    { key: 'world', url: `${CMS_BASE}/category/category/top-world/feed/json/app/` },
    { key: 'lifestyle', url: `${CMS_BASE}/category/category/top-lifestyle/feed/json/app/` },
    { key: 'all-lifestyle', url: `${CMS_BASE}/category/category/leisure/feed/json/app/` },
    { key: 'business', url: `${CMS_BASE}/category/category/top-business/feed/json/app/` },
    { key: 'all-business', url: `${CMS_BASE}/category/category/business/feed/json/app/` },
    { key: 'sports', url: `${CMS_BASE}/category/category/top-sports/feed/json/app/` },
    { key: 'all-sports', url: `${CMS_BASE}/category/category/sports/feed/json/app/` },
    { key: 'malaysia', url: `${CMS_BASE}/category/category/nation/feed/json/app/` },
    { key: 'borneo+', url: `${CMS_BASE}/category/category/nation/sabahsarawak/feed/json/app/` },
    { key: 'south-east-asia', url: `${CMS_BASE}/category/category/south-east-asia/feed/json/app/` },
    { key: 'tempatan', url: `${CMS_BASE}/category/category/tempatan/feed/json/app/` },
    { key: 'dunia', url: `${CMS_BASE}/category/category/bahasa/dunia/feed/json/app/` },
    { key: 'pandangan', url: `${CMS_BASE}/category/category/bahasa/pandangan/feed/json/app/` },
    { key: 'column', url: `${CMS_BASE}/category/category/opinion/column/feed/json/app/` },
    { key: 'editorial', url: `${CMS_BASE}/category/category/opinion/editorial/feed/json/app/` },
    { key: 'letter', url: `${CMS_BASE}/category/category/opinion/letters/feed/json/app/` },
    { key: 'local-business', url: `${CMS_BASE}/category/category/business/local-business/feed/json/app/` },
    { key: 'world-business', url: `${CMS_BASE}/category/category/business/world-business/feed/json/app/` },
    { key: 'property', url: `${CMS_BASE}/category/category/leisure/property/feed/json/app/` },
    { key: 'football', url: `${CMS_BASE}/category/category/sports/football/feed/json/app/` },
    { key: 'badminton', url: `${CMS_BASE}/category/category/sports/badminton/feed/json/app/` },
    { key: 'motorsports', url: `${CMS_BASE}/category/category/sports/motorsports/feed/json/app/` },
    { key: 'tennis', url: `${CMS_BASE}/category/category/sports/tennis/feed/json/app/` },
    { key: 'travel', url: `${CMS_BASE}/category/category/leisure/travel/feed/json/app/` },
    { key: 'automotive', url: `${CMS_BASE}/category/category/leisure/automotive/feed/json/app/` },
    { key: 'food', url: `${CMS_BASE}/category/category/leisure/food/feed/json/app/` },
    { key: 'health', url: `${CMS_BASE}/category/category/leisure/health/feed/json/app/` },
    { key: 'entertainment', url: `${CMS_BASE}/category/category/leisure/entertainment/feed/json/app/` },
    { key: 'money', url: `${CMS_BASE}/category/category/leisure/money/feed/json/app/` },
    { key: 'pets', url: `${CMS_BASE}/category/category/leisure/pets/feed/json/app/` },
    { key: 'simple-stories', url: `${CMS_BASE}/category/category/leisure/simple-stories/feed/json/app/` },
    // ✅ S3 video feeds
    { key: 'fmt-news', url: `${S3_BASE}/json/app/list/video-news.json` },
    { key: 'fmt-lifestyle', url: `${S3_BASE}/json/app/list/video-lifestyle.json` },
    { key: 'fmt-exclusive', url: `${S3_BASE}/json/app/list/video-exclusive.json` },
    { key: 'fmt-news-capsule', url: `${S3_BASE}/json/app/list/video-news-capsule.json` },
];
