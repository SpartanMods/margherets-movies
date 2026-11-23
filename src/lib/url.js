// Every internal link goes through here so the GitHub Pages base path
// (/margherets-movies) is applied consistently.
const BASE = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '');

export function url(path = '') {
  const clean = String(path).replace(/^\/+/, '');
  return clean ? `${BASE}/${clean}` : `${BASE}/`;
}

export function reviewUrl(slug) {
  return url(`reviews/${slug}/`);
}
