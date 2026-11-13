import { loadJobs } from '../lib/jobLoader.js';
import { buildSearchIndex } from '../lib/searchIndex.js';

/** Static endpoint: emitted as /search-index.json at build time, fetched once by the browser. */
export async function GET() {
  const { jobs } = await loadJobs();
  return new Response(JSON.stringify(buildSearchIndex(jobs)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
