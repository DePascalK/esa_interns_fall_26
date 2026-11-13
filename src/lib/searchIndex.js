/**
 * Builds the serialized search index at build time. Only the text that
 * distinguishes postings is indexed: boilerplate (diversity statement,
 * disclaimers, standard requirements) and constant columns are left out.
 */
import MiniSearch from 'minisearch';
import { MINISEARCH_OPTIONS } from './searchConfig.js';

export function toSearchDocument(job) {
  return {
    id: job.id,
    title: job.title,
    topic: [job.headline, job.topic].filter(Boolean).join(' '),
    skills: job.skills.join(' '),
    disciplines: job.disciplines.map((d) => d.label).join(' '),
    tasks: job.search.tasks,
    requirements: job.search.requirements,
    org: [job.department, job.unit, job.directorate, job.site.name, job.site.city, job.workplace]
      .filter(Boolean)
      .join(' '),
  };
}

/** @returns {object} plain JSON-serialisable index */
export function buildSearchIndex(jobs) {
  const ms = new MiniSearch(MINISEARCH_OPTIONS);
  ms.addAll(jobs.map(toSearchDocument));
  return ms.toJSON();
}
