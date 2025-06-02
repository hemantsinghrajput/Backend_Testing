const API_URL = "https://staging-cms.freemalaysiatoday.com/graphql";

interface GQLFetchOptions {
  variables?: any;
}

export async function gqlFetchAPI(query: string = '', options: GQLFetchOptions = {}): Promise<any> {
  const { variables } = options;

  const fetch = (await import('node-fetch')).default;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('Network response error:', {
      status: res.status,
      statusText: res.statusText,
      body: errorText,
    });
    throw new Error(`Network response not ok: ${res.status}`);
  }

  const json = await res.json() as any;

  if (json.errors) {
    console.error('GraphQL Errors:', json.errors);
    throw new Error(json.errors[0]?.message || 'Failed to fetch API');
  }

  return json.data;
}
