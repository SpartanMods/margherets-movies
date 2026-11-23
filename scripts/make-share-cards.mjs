// Builds 1200x630 social share images (public/og/<slug>.png) for each review,
// plus public/og/default.png for the rest of the site. Marquee-lit, on brand.
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { loadReviews } from '../src/lib/load.js';
import { tierFor } from '../src/lib/tiers.js';

const ROOT = process.cwd();
const OUT = join(ROOT, 'public', 'og');
mkdirSync(OUT, { recursive: true });

const W = 1200;
const H = 630;
const SERIF = "Georgia, 'DejaVu Serif', 'Times New Roman', serif";
const SANS = "'Segoe UI', 'DejaVu Sans', Arial, sans-serif";

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function wrap(text, maxChars, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars && line) { lines.push(line); line = w; } else line = (line + ' ' + w).trim();
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s+\S*$/, '') + '…';
    return kept;
  }
  return lines;
}

function bulbFrame(x, y, w, h, gap = 26, r = 4.5) {
  const out = [];
  const nx = Math.floor(w / gap);
  const ny = Math.floor(h / gap);
  const sx = w / nx;
  const sy = h / ny;
  for (let i = 0; i <= nx; i++) { out.push([x + i * sx, y]); out.push([x + i * sx, y + h]); }
  for (let j = 1; j < ny; j++) { out.push([x, y + j * sy]); out.push([x + w, y + j * sy]); }
  return out.map(([cx, cy], i) =>
    `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r + 5}" fill="url(#glow)" opacity="${i % 2 ? 0.55 : 0.9}"/>` +
    `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="#ffe9b0"/>`
  ).join('');
}

function sunburst(cx, cy, rays = 28, len = 900) {
  let out = '';
  for (let i = 0; i < rays; i += 2) {
    const a1 = (i / rays) * Math.PI * 2;
    const a2 = ((i + 1) / rays) * Math.PI * 2;
    out += `<path d="M${cx},${cy} L${cx + Math.cos(a1) * len},${cy + Math.sin(a1) * len} L${cx + Math.cos(a2) * len},${cy + Math.sin(a2) * len} Z" fill="#e6b84f" opacity="0.05"/>`;
  }
  return out;
}

function baseDefs() {
  return `
  <defs>
    <radialGradient id="glow"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.9"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
    <radialGradient id="velvet" cx="0.3" cy="0.2" r="1"><stop offset="0" stop-color="#3a0c12"/><stop offset="0.55" stop-color="#170809"/><stop offset="1" stop-color="#0b0809"/></radialGradient>
    <linearGradient id="gold" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f8e3a0"/><stop offset="1" stop-color="#d49a2c"/></linearGradient>
    <linearGradient id="shade" x1="0" x2="1"><stop offset="0" stop-color="#0b0809" stop-opacity="0.55"/><stop offset="0.45" stop-color="#0b0809" stop-opacity="0.92"/><stop offset="1" stop-color="#0b0809" stop-opacity="0.97"/></linearGradient>
  </defs>`;
}

function titleCardSvg(title, year, x, y, w, h) {
  const lines = wrap(title.toUpperCase(), 12, 4);
  const lh = 44;
  const top = y + h / 2 - ((lines.length - 1) * lh) / 2;
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#5c0f16"/>
  <rect x="${x + 12}" y="${y + 12}" width="${w - 24}" height="${h - 24}" rx="6" fill="none" stroke="#e6b84f" stroke-width="2" opacity="0.7"/>
  ${lines.map((l, i) => `<text x="${x + w / 2}" y="${top + i * lh}" text-anchor="middle" font-family="${SERIF}" font-size="38" font-weight="700" fill="url(#gold)" letter-spacing="2">${esc(l)}</text>`).join('')}
  ${year ? `<text x="${x + w / 2}" y="${y + h - 40}" text-anchor="middle" font-family="${SANS}" font-size="20" letter-spacing="6" fill="#f3e9da" opacity="0.8">${year}</text>` : ''}`;
}

async function reviewCard(r) {
  const tier = tierFor(r.score);
  const posterX = 90;
  const posterY = 95;
  const posterW = 290;
  const posterH = 435;
  const textX = 440;
  const titleLines = wrap(r.title, 20, 2);
  const headLines = r.headline ? wrap(r.headline, 38, 2) : [];
  const titleSize = titleLines.some((l) => l.length > 15) ? 64 : 76;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${baseDefs()}
  ${r.backdrop ? '' : `<rect width="${W}" height="${H}" fill="url(#velvet)"/>`}
  <rect width="${W}" height="${H}" fill="url(#shade)"/>
  ${sunburst(W - 150, H + 60)}
  ${bulbFrame(28, 28, W - 56, H - 56)}
  ${r.poster ? `<rect x="${posterX - 6}" y="${posterY - 6}" width="${posterW + 12}" height="${posterH + 12}" rx="12" fill="#e6b84f" opacity="0.85"/>` : titleCardSvg(r.title, r.year, posterX, posterY, posterW, posterH)}
  <text x="${textX}" y="125" font-family="${SANS}" font-size="20" letter-spacing="7" fill="#e6b84f">MARGHERET'S MOVIES · REVIEW</text>
  ${titleLines.map((l, i) => `<text x="${textX}" y="${205 + i * (titleSize + 6)}" font-family="${SERIF}" font-size="${titleSize}" font-weight="700" fill="#f8efe0">${esc(l)}</text>`).join('')}
  ${headLines.map((l, i) => `<text x="${textX}" y="${205 + titleLines.length * (titleSize + 6) + 10 + i * 40}" font-family="${SERIF}" font-style="italic" font-size="32" fill="#d9c9b1">${esc(l)}</text>`).join('')}
  ${r.score != null ? `
  <g transform="translate(${textX}, 420)">
    <rect width="190" height="120" rx="14" fill="#170809" stroke="#e6b84f" stroke-width="3"/>
    ${bulbFrame(10, 10, 170, 100, 21, 3.2)}
    <text x="95" y="86" text-anchor="middle" font-family="${SERIF}" font-size="68" font-weight="700" fill="url(#gold)">${r.score}</text>
  </g>
  <text x="${textX + 220}" y="470" font-family="${SANS}" font-size="22" letter-spacing="5" fill="#e6b84f">${esc((tier?.name ?? '').toUpperCase())}</text>
  <text x="${textX + 220}" y="510" font-family="${SERIF}" font-size="26" fill="#d9c9b1">${r.year ?? ''}${r.credits?.director?.length ? ` · ${esc(r.credits.director[0])}` : ''}</text>` : ''}
</svg>`;

  const layers = [];
  let base;
  if (r.backdrop && existsSync(join(ROOT, 'public', r.backdrop))) {
    base = sharp(join(ROOT, 'public', r.backdrop)).resize(W, H, { fit: 'cover' }).blur(6).modulate({ brightness: 0.7 });
  } else {
    base = sharp({ create: { width: W, height: H, channels: 4, background: '#0b0809' } });
  }
  layers.push({ input: Buffer.from(svg), top: 0, left: 0 });
  if (r.poster && existsSync(join(ROOT, 'public', r.poster))) {
    const poster = await sharp(join(ROOT, 'public', r.poster)).resize(posterW, posterH, { fit: 'cover' }).png().toBuffer();
    layers.push({ input: poster, top: posterY, left: posterX });
  }
  await base.composite(layers).png().toFile(join(OUT, `${r.slug}.png`));
}

async function defaultCard() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${baseDefs()}
  <rect width="${W}" height="${H}" fill="url(#velvet)"/>
  ${sunburst(W / 2, H + 120, 36, 1100)}
  ${bulbFrame(28, 28, W - 56, H - 56)}
  <text x="${W / 2}" y="210" text-anchor="middle" font-family="${SANS}" font-size="22" letter-spacing="10" fill="#e6b84f">NOW SHOWING</text>
  <text x="${W / 2}" y="320" text-anchor="middle" font-family="${SERIF}" font-size="96" font-weight="700" fill="url(#gold)" letter-spacing="4">MARGHERET'S</text>
  <text x="${W / 2}" y="420" text-anchor="middle" font-family="${SERIF}" font-size="96" font-weight="700" fill="url(#gold)" letter-spacing="18">MOVIES</text>
  <text x="${W / 2}" y="500" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="30" fill="#d9c9b1">A palace for honest movie reviews</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(join(OUT, 'default.png'));
}

await defaultCard();
const reviews = loadReviews();
for (const r of reviews) await reviewCard(r);
console.log(`[share-cards] Wrote default.png and ${reviews.length} review card${reviews.length === 1 ? '' : 's'}.`);
