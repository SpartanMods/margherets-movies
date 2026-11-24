// Looks up every reviewed film and every Coming Attraction on TMDB, then saves
// poster + backdrop images into public/tmdb and details into src/data/tmdb-cache.json.
// Films already in the cache are skipped, so this is quick after the first run.
//
// Needs TMDB_API_KEY (in .env locally, or as a GitHub Actions secret).
// Without a key it prints a note and exits cleanly; the site then uses
// designed marquee title cards instead of posters.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { loadReviews } from '../src/lib/load.js';
import { movieKey } from '../src/lib/movie-key.js';

const ROOT = process.cwd();
const CACHE_FILE = join(ROOT, 'src', 'data', 'tmdb-cache.json');
const COMING_FILE = join(ROOT, 'src', 'data', 'coming-attractions.json');
const IMG_DIR = join(ROOT, 'public', 'tmdb');

function loadDotEnv() {
  const file = join(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

loadDotEnv();
const KEY = (process.env.TMDB_API_KEY || '').trim();

if (!KEY) {
  console.log('[tmdb] No TMDB_API_KEY set. Skipping poster lookup (designed title cards will be used).');
  process.exit(0);
}

const useBearer = KEY.length > 60 || KEY.startsWith('eyJ');

async function tmdb(path, params = {}) {
  const u = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') u.searchParams.set(k, String(v));
  if (!useBearer) u.searchParams.set('api_key', KEY);
  const res = await fetch(u, { headers: useBearer ? { Authorization: `Bearer ${KEY}`, accept: 'application/json' } : { accept: 'application/json' } });
  if (res.status === 401) throw new Error('TMDB rejected the API key (401). Check TMDB_API_KEY.');
  if (!res.ok) throw new Error(`TMDB ${path} failed: ${res.status}`);
  return res.json();
}

async function saveImage(path, size, outName, width) {
  if (!path) return null;
  const res = await fetch(`https://image.tmdb.org/t/p/${size}${path}`);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(IMG_DIR, { recursive: true });
  await sharp(buf).resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(join(IMG_DIR, outName));
  return `tmdb/${outName}`;
}

function pickMatch(results, title, year) {
  const t = title.toLowerCase();
  const yearOf = (r) => Number((r.release_date || '').slice(0, 4)) || null;
  return (
    results.find((r) => r.title?.toLowerCase() === t && (!year || yearOf(r) === year)) ||
    results.find((r) => !year || yearOf(r) === year) ||
    results[0] ||
    null
  );
}

async function lookup({ title, year }) {
  let { results = [] } = await tmdb('/search/movie', { query: title, year, include_adult: 'false' });
  if (!results.length && year) ({ results = [] } = await tmdb('/search/movie', { query: title, include_adult: 'false' }));
  const hit = pickMatch(results, title, year);
  if (!hit) return null;
  const d = await tmdb(`/movie/${hit.id}`);
  const key = movieKey(title, year);
  const [poster, backdrop] = await Promise.all([
    saveImage(d.poster_path, 'w780', `${key}-poster.webp`, 600),
    saveImage(d.backdrop_path, 'w1280', `${key}-backdrop.webp`, 1600),
  ]);
  return {
    id: d.id,
    title: d.title,
    year: Number((d.release_date || '').slice(0, 4)) || year || null,
    genres: (d.genres || []).map((g) => g.name),
    runtime: d.runtime || null,
    poster,
    backdrop,
    fetchedAt: new Date().toISOString().slice(0, 10),
  };
}

const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
const wanted = [
  ...loadReviews().map((r) => ({ title: r.title, year: r.year })),
  ...JSON.parse(readFileSync(COMING_FILE, 'utf8')),
];

let added = 0;
for (const film of wanted) {
  const key = movieKey(film.title, film.year);
  if (cache[key]) continue;
  try {
    const info = await lookup(film);
    if (info) {
      cache[key] = info;
      added++;
      console.log(`[tmdb] ${film.title}${film.year ? ` (${film.year})` : ''} -> TMDB #${info.id}${info.poster ? '' : ' (no poster)'}`);
    } else {
      console.warn(`[tmdb] No TMDB match for "${film.title}". It will use a title card.`);
    }
  } catch (err) {
    console.warn(`[tmdb] ${film.title}: ${err.message}`);
    if (/401/.test(err.message)) break;
  }
}

// Extra stills for reviewed films: wide, text-free frames placed between review sections.
const STILL_COUNT = 4;
let stillsAdded = 0;
for (const r of loadReviews()) {
  const key = movieKey(r.title, r.year);
  const entry = cache[key];
  if (!entry?.id || Array.isArray(entry.stills)) continue;
  try {
    const { backdrops = [] } = await tmdb(`/movie/${entry.id}/images`, { include_image_language: 'null' });
    const picks = backdrops
      .filter((b) => b.aspect_ratio > 1.6 && b.width >= 1280)
      .sort((a, b) => (b.vote_count - a.vote_count) || (b.vote_average - a.vote_average))
      .slice(1, STILL_COUNT + 1); // skip the top one, which is usually the hero backdrop
    const stills = [];
    for (let i = 0; i < picks.length; i++) {
      const file = await saveImage(picks[i].file_path, 'w1280', `${key}-still-${i + 1}.webp`, 1400);
      if (file) stills.push(file);
    }
    entry.stills = stills;
    stillsAdded++;
    console.log(`[tmdb] ${r.title}: ${stills.length} stills saved.`);
  } catch (err) {
    console.warn(`[tmdb] ${r.title} stills: ${err.message}`);
  }
}

if (added || stillsAdded) writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2) + '\n');
console.log(`[tmdb] Done. ${added} new film${added === 1 ? '' : 's'} cached.`);
