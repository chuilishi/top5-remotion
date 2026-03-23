#!/usr/bin/env node
const url = process.argv[2];
if (!url) { console.error('Usage: node firecrawl.mjs "https://example.com"'); process.exit(1); }
const key = 'fc-0c14c22b08c34eec90be9e203c91bdfd';
const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ url, formats: ['markdown'] }),
});
const data = await res.json();
if (data.success && data.data?.markdown) {
  console.log(data.data.markdown);
} else {
  console.error(JSON.stringify(data, null, 2));
}
