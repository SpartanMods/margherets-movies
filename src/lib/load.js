// Reads every review in /reviews and the coming-attractions list.
// Plain Node (no Astro imports) so build scripts and pages share it.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseReview } from './parse-review.js';
import { movieKey, genresFromTags } from './movie-key.js';

const ROOT = process.cwd();
export const REVIEWS_DIR = join(ROOT, 'reviews');
const CACHE_FILE = join(ROOT, 'src', 'data', 'tmdb-cache.json');
const COMING_FILE = join(ROOT, 'src', 'data', 'coming-attractions.json');

function readJson(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function readCache() {
  return readJson(CACHE_FILE, {});
}

/** First-commit date of a file from git, so publish dates survive fresh checkouts. */
function gitDate(file) {
  const candidates = [process.env.GIT_BIN, 'git'].filter(Boolean);
  for (const bin of candidates) {
    try {
      const out = execFileSync(bin, ['log', '--diff-filter=A', '--follow', '--format=%aI', '--', file], {
        cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      }).trim().split('\n').filter(Boolean);
      // %aI keeps the author's own UTC offset, so its first 10 chars are their calendar day.
      if (out.length) return calendarDay(out[out.length - 1].slice(0, 10));
    } catch { /* git missing or file untracked */ }
  }
  return null;
}

/** A Date pinned to UTC midnight of a calendar day, so it formats the same everywhere. */
function calendarDay(ymd) {
  return new Date(`${ymd}T00:00:00Z`);
}

function localDay(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return calendarDay(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
}

function publishDate(review, file) {
  if (review.publishedText) {
    const d = new Date(review.publishedText);
    if (!Number.isNaN(d.valueOf())) return localDay(d);
  }
  return gitDate(file) ?? localDay(statSync(file).mtime);
}

export function loadReviews() {
  if (!existsSync(REVIEWS_DIR)) return [];
  const cache = readCache();
  const files = readdirSync(REVIEWS_DIR).filter((f) => /\.md$/i.test(f) && !f.startsWith('_'));
  const reviews = files.map((name) => {
    const file = join(REVIEWS_DIR, name);
    const review = parseReview(readFileSync(file, 'utf8'), { fileName: name });
    const tmdb = cache[movieKey(review.title, review.year)] ?? null;
    const genres = review.genresFromPack.length
      ? review.genresFromPack
      : tmdb?.genres?.length ? tmdb.genres : genresFromTags(review.tags);
    const date = publishDate(review, file);
    return {
      ...review,
      file: name,
      date,
      genres,
      decade: review.year ? `${Math.floor(review.year / 10) * 10}s` : null,
      runtime: review.credits.runtime ?? tmdb?.runtime ?? null,
      poster: tmdb?.poster ?? null,
      backdrop: tmdb?.backdrop ?? null,
      stills: tmdb?.stills ?? [],
      tmdbId: tmdb?.id ?? null,
    };
  });
  // Newest first.
  return reviews.sort((a, b) => b.date - a.date || a.title.localeCompare(b.title));
}

export function loadComingAttractions(reviews = loadReviews()) {
  const cache = readCache();
  const reviewed = new Set(reviews.map((r) => r.title.toLowerCase()));
  return readJson(COMING_FILE, [])
    .filter((m) => m && m.title && !reviewed.has(m.title.toLowerCase()))
    .map((m) => {
      const tmdb = cache[movieKey(m.title, m.year)] ?? null;
      return {
        title: m.title,
        year: m.year ?? tmdb?.year ?? null,
        poster: tmdb?.poster ?? null,
        genres: tmdb?.genres ?? [],
        tmdbId: tmdb?.id ?? null,
      };
    });
}
