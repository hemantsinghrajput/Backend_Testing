// types/Article.ts

export interface Article {
    id: number;
    title: string;
    permalink: string;
    content: string;
    excerpt: string;
    date: string;
    author: string;
    thumbnail: string;
    slug: string;
    categories: string[];
    "featured-category"?: string;
    tags?: {
      title: string;
      slug: string;
    }[];
    "related-articles"?: {
      id: number;
      title: string;
      permalink: string;
      excerpt: string;
      date: string;
      thumbnail: string;
      "dynamic-link"?: string;
    }[];
    "dynamic-link"?: string;
    type?: string;
  }
  