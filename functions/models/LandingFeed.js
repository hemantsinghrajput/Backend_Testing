"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// models/LandingFeed.ts
const mongoose_1 = require("mongoose");
const ArticleSchema = new mongoose_1.Schema({
    id: Number,
    title: String,
    permalink: String,
    content: String,
    excerpt: String,
    date: String,
    author: String,
    thumbnail: String,
    categories: [String],
    'featured-category': String,
    tags: [{ title: String, slug: String }],
    'related-articles': [{
            id: Number,
            title: String,
            permalink: String,
            excerpt: String,
            date: String,
            thumbnail: String,
            'dynamic-link': String,
        }],
    'dynamic-link': String,
    type: String,
}, { _id: false });
const LandingFeedSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true },
    articles: [ArticleSchema],
    updatedAt: { type: Date, default: Date.now },
});
exports.default = (0, mongoose_1.model)('LandingFeed', LandingFeedSchema);
