import { slugify } from './parse-review.js';

/** Stable key for a film in the TMDB cache: "pay-it-forward-2000". */
export function movieKey(title, year) {
  return slugify(`${title} ${year ?? ''}`);
}

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family',
  'Fantasy', 'History', 'Horror', 'Music', 'Musical', 'Mystery', 'Romance', 'Science Fiction',
  'Sci-Fi', 'Thriller', 'War', 'Western', 'Biography', 'Sports', 'Satire', 'Noir',
];

/** Pick genre words out of free-form tags, for when TMDB data isn't available. */
export function genresFromTags(tags = []) {
  const out = [];
  for (const t of tags) {
    const hit = GENRES.find((g) => g.toLowerCase() === String(t).toLowerCase());
    if (hit) out.push(hit === 'Sci-Fi' ? 'Science Fiction' : hit);
  }
  return [...new Set(out)];
}
