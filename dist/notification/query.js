"use strict";
// === 🔸 GRAPHQL Query for Latest Posts ===
const GET_LATEST_NEWS = `
  query GetLatestPosts {
    posts(first: 10) {
      nodes {
        title
        date
        slug
        modified
        categories {
          nodes {
            name
          }
        }
      }
    }
  }
`;
module.exports = { GET_LATEST_NEWS };
