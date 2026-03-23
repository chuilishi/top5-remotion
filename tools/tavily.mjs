#!/usr/bin/env node
const query = process.argv.slice(2).join(' ');
if (!query) { console.error('Usage: node tavily.mjs "search query"'); process.exit(1); }
const key = process.env.TAVILY_API_KEY || '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';
const res = await fetch('https://api.tavily.com/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, max_results: 10, api_key: key }),
});
const data = await res.json();
if (data.results) {
  for (const r of data.results) {
    console.log(`## ${r.title}`);
    console.log(r.url);
    console.log(r.content?.substring(0, 300) || '');
    console.log();
  }
} else {
  console.log(JSON.stringify(data, null, 2));
}
