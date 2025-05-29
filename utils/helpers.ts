export const processYouTubeData = (items: any[]) => {
    return items.map((item, index) => {
      const videoId = item.snippet?.resourceId?.videoId;
      return {
        id: item.id || videoId || `yt-${index}`,
        title: item.snippet?.title,
        excerpt: item.snippet?.description || '',
        date: item.snippet?.publishedAt,
        thumbnail: item.snippet?.thumbnails?.high?.url || '',
        permalink: `https://www.youtube.com/watch?v=${videoId}`,
        videoId,
        type: index === 0 ? 'video-featured' : 'video',
        content: item.snippet?.description || '',
      };
    });
  };
  
  export const filterValidArticles = (articles: any[]) => {
    const seen = new Set();
    return articles.filter((item) => {
      const slug = item.slug || item.permalink?.split('/').filter(Boolean).pop();
      if (!slug || seen.has(slug)) return false;
      seen.add(slug);
      return !!item.title && !!item.thumbnail;
    });
  };
  