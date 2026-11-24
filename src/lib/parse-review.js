// Turns a review .md file, written the way the movie-critic skill writes them,
// into structured data for the site. No front matter is required:
//
//   # Title (Year) Review: Headline
//   ...body with ## sections...
//   [SPOILERS START] ... [SPOILERS END]      -> velvet curtain
//   | Category | 18/20 | ... | Total | 88/100 -> scorecard
//   ## Publish pack                           -> metadata, never shown to readers
//
// Plain JavaScript (no Astro imports) so the build scripts can use it too.
import { Marked } from 'marked';

export const SCORECARD_TOKEN = '<!--MM:SCORECARD-->';
export const PULLQUOTE_TOKEN = '<!--MM:PULLQUOTE-->';
export const STILL_TOKEN = '<!--MM:STILL-->';

export function slugify(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&[a-z]+;|&#\d+;/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function decodeEntities(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripMarkdown(s) {
  return decodeEntities(s)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\\([[\]()*_#])/g, '$1')
    .trim();
}

// ---------- Title line ----------

function parseTitleLine(line) {
  const raw = stripMarkdown(line.replace(/^#\s+/, ''));
  // "Pay It Forward (2000) Review: The Opposite of an Eye for an Eye"
  const m = raw.match(/^(.+?)\s*\((\d{4})\)\s*(?:[-:|–]\s*)?(?:Review\b\s*[:\-–|]?\s*)?(.*)$/i);
  if (m) return { title: m[1].trim(), year: Number(m[2]), headline: m[3].trim() || null, fullHeadline: raw };
  const r = raw.match(/^(.+?)\s+Review\s*[:\-–|]\s*(.+)$/i);
  if (r) return { title: r[1].trim(), year: null, headline: r[2].trim(), fullHeadline: raw };
  return { title: raw, year: null, headline: null, fullHeadline: raw };
}

// ---------- Publish pack ----------

const FIELD_ALIASES = [
  [/^headlines?( options)?$/, 'headlines'],
  [/^(url )?slug$/, 'slug'],
  [/^meta( description)?$/, 'metaDescription'],
  [/^(excerpt|dek|excerpt or dek|standfirst)$/, 'excerpt'],
  [/^rating( line)?$|^score( line)?$/, 'ratingLine'],
  [/^pull ?quote$/, 'pullQuote'],
  [/^tags?$/, 'tags'],
  [/^credits?( box)?$/, 'credits'],
  [/^(published|date|publish date|published on)$/, 'published'],
  [/^genres?$/, 'genres'],
];

function aliasFor(label) {
  const key = label.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
  for (const [re, name] of FIELD_ALIASES) if (re.test(key)) return name;
  return null;
}

function parsePublishPack(text) {
  const fields = {};
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const bullet = line.match(/^[-*+]\s+(.*)$/);
    const content = bullet ? bullet[1] : line;
    const kv = content.match(/^\**([A-Za-z][A-Za-z ()/]{1,40}?)\**\s*:\s*(.*)$/);
    const alias = kv ? aliasFor(kv[1]) : null;
    if (alias) {
      current = alias;
      fields[current] ??= [];
      if (kv[2].trim()) fields[current].push(kv[2].trim());
    } else if (current) {
      fields[current].push(content);
    }
  }
  const one = (k) => (fields[k] ? stripMarkdown(fields[k].join(' ')) : null);
  const list = (k) => (fields[k] ? fields[k].map(stripMarkdown).filter(Boolean) : []);
  const splitTags = (arr) => arr.flatMap((t) => t.split(/\s*,\s*/)).map((t) => t.replace(/^#/, '').trim()).filter(Boolean);

  return {
    headlines: list('headlines'),
    slug: one('slug') ? slugify(one('slug')) : null,
    metaDescription: one('metaDescription'),
    excerpt: one('excerpt'),
    ratingLine: one('ratingLine'),
    pullQuote: one('pullQuote')?.replace(/^["“'‘]+|["”'’]+$/g, '').trim() || null,
    tags: splitTags(list('tags')),
    genres: splitTags(list('genres')),
    published: one('published'),
    creditsText: fields.credits ? fields.credits.map(stripMarkdown).join('\n') : '',
  };
}

function splitNames(s) {
  return s
    .split(/\s*,\s*|\s+and\s+|\s*&\s*/)
    .map((n) => n.replace(/\s*\([^)]*\)\s*$/, '').trim())
    .filter((n) => n && n.length < 60);
}

function parseCredits(text) {
  if (!text) return {};
  const flat = text.replace(/\n/g, '. ').replace(/\.\s*\./g, '.');
  const end = String.raw`(?=\.\s|\.$|;|$)`;
  const grab = (re) => flat.match(re)?.[1]?.trim() ?? null;

  const director = grab(new RegExp(String.raw`Direct(?:ed(?: and written)? by|or|ors)\s*:?\s*(.+?)` + end, 'i'));
  const writing = grab(new RegExp(String.raw`(?:Screenplay|Written|Writers?|Writing)\s*(?:by)?\s*:?\s*(.+?)` + end, 'i'));
  const cast = grab(new RegExp(String.raw`(?:Starring|Cast|Stars)\s*:?\s*(.+?)` + end, 'i'));
  const hm = flat.match(/\b(\d)\s*h(?:rs?|ours?)?\s*(\d{1,2})\s*m(?:in(?:utes?)?)?\b/i);
  const mins = flat.match(/\b(\d{2,3})\s*(?:min|minutes)\b/i);
  const runtime = hm ? Number(hm[1]) * 60 + Number(hm[2]) : mins ? Number(mins[1]) : null;
  const rated = grab(/\bRated\s*:?\s*(NC-17|PG-13|PG|G|R|NR|Not Rated|Unrated|TV-MA|TV-14|TV-PG)\b/i);
  const wtw = flat.match(/Where to watch\s*(\(([^)]*)\))?\s*:\s*(.+?)(?=\.\s+[A-Z][a-z]+ (?:by|to)\b|$)/i);

  return {
    director: director ? splitNames(director) : [],
    writing,
    cast: cast ? splitNames(cast) : [],
    runtime,
    rated: rated ? rated.toUpperCase().replace('NOT RATED', 'Not Rated').replace('UNRATED', 'Unrated') : null,
    whereToWatch: wtw ? wtw[3].replace(/\.$/, '').trim() : null,
    whereToWatchNote: wtw?.[2]?.trim() ?? null,
  };
}

// ---------- Score table ----------

function parseScoreTable(lines) {
  // Returns { categories, total, max, start, end } for the first table that looks like a scorecard.
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*\|/.test(lines[i])) continue;
    let j = i;
    while (j < lines.length && /^\s*\|/.test(lines[j])) j++;
    const rows = lines.slice(i, j)
      .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => stripMarkdown(c)))
      .filter((cells) => !cells.every((c) => /^:?-{2,}:?$/.test(c) || c === ''));
    const categories = [];
    let total = null;
    let max = 100;
    for (const cells of rows) {
      const name = cells[0];
      const valueCell = cells.slice(1).find((c) => /\d+(\.\d+)?\s*(\/\s*\d+)?/.test(c));
      if (!name || !valueCell) continue;
      const m = valueCell.match(/(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+))?/);
      const score = Number(m[1]);
      const outOf = m[2] ? Number(m[2]) : null;
      if (/^(total|overall|final|score)$/i.test(name)) {
        total = score;
        if (outOf) max = outOf;
      } else if (outOf) {
        categories.push({ name, score, max: outOf, pct: outOf ? score / outOf : 0 });
      }
    }
    if (categories.length >= 2) {
      if (total == null) total = categories.reduce((a, c) => a + c.score, 0);
      return { categories, total, max, start: i, end: j };
    }
    i = j;
  }
  return null;
}

// Score as a list: "- Story and writing: 20/20" lines, with an optional "Total: 97/100" line.
const SCORE_ITEM_RE = /^\s*[-*+]\s+\**([A-Za-z][A-Za-z &/']{1,40}?)\**\s*:\s*\**(\d+(?:\.\d+)?)\s*\/\s*(\d+)\**\s*$/;
const SCORE_TOTAL_RE = /^\s*(?:[-*+]\s+)?\**(total|overall|final score|final)\**\s*:\s*\**(\d+(?:\.\d+)?)\s*\/\s*(\d+)\**\s*$/i;

function parseScoreList(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (!SCORE_ITEM_RE.test(lines[i])) continue;
    let j = i;
    const categories = [];
    let total = null;
    let max = 100;
    while (j < lines.length && (SCORE_ITEM_RE.test(lines[j]) || SCORE_TOTAL_RE.test(lines[j]) || !lines[j].trim())) {
      const t = lines[j].match(SCORE_TOTAL_RE);
      const m = lines[j].match(SCORE_ITEM_RE);
      if (t) { total = Number(t[2]); max = Number(t[3]); }
      else if (m) categories.push({ name: m[1].trim(), score: Number(m[2]), max: Number(m[3]), pct: Number(m[2]) / Number(m[3]) });
      j++;
    }
    while (j > i && !lines[j - 1].trim()) j--;
    if (categories.length >= 2) {
      if (total == null) total = categories.reduce((a, c) => a + c.score, 0);
      return { categories, total, max, start: i, end: j };
    }
    i = j;
  }
  return null;
}

// ---------- Spoilers ----------

function spoilerMarker(line) {
  const norm = decodeEntities(line).replace(/[*_\\]/g, '').trim();
  const m = norm.match(/^[[(【]?\s*spoilers?\s*(?:warning\s*)?[:\-–]?\s*(start|starts|begin|begins|end|ends)\s*[\])】]?$/i);
  if (!m) return null;
  return /^(start|begin)/i.test(m[1]) ? 'start' : 'end';
}

// ---------- Main ----------

export function parseReview(source, { fileName = '' } = {}) {
  const text = source.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  const h1Index = lines.findIndex((l) => /^#\s+\S/.test(l));
  const titleInfo = h1Index >= 0
    ? parseTitleLine(lines[h1Index])
    : parseTitleLine(fileName.replace(/\.md$/i, ''));

  const packIndex = lines.findIndex((l) => /^#{1,6}\s*publish(ing)? pack\b/i.test(l.trim()));
  const pack = packIndex >= 0 ? parsePublishPack(lines.slice(packIndex + 1).join('\n')) : parsePublishPack('');

  let body = lines.slice(h1Index + 1, packIndex >= 0 ? packIndex : lines.length);

  // Header block (before the first ## section): a bare "Score: 97/100" line is shown by the
  // marquee instead, and a credits line ("Directed by ... Starring ...") fills the ticket
  // when there's no Publish pack credits.
  const firstH2 = body.findIndex((l) => /^##\s/.test(l));
  const headerEnd = firstH2 === -1 ? 0 : firstH2;
  let headerTotal = null;
  for (let i = 0; i < headerEnd; i++) {
    const l = stripMarkdown(body[i]);
    const s = l.match(/^(?:my )?score\s*:\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+)\.?$/i);
    if (s) { headerTotal = { total: Number(s[1]), max: Number(s[2]) }; body[i] = ''; continue; }
    if (!pack.creditsText && /^(Directed|Written|Starring|Screenplay)\b/i.test(l)) { pack.creditsText = l; body[i] = ''; }
  }
  const credits = parseCredits(pack.creditsText);

  // Spoilers marked only by a "## Spoiler..." heading: curtain everything under it until the next ## heading.
  if (!body.some((l) => spoilerMarker(l))) {
    const sp = body.findIndex((l) => /^##\s.*spoiler/i.test(l));
    if (sp !== -1) {
      let next = body.findIndex((l, k) => k > sp && /^##\s/.test(l));
      if (next === -1) next = body.length;
      body = [...body.slice(0, sp + 1), '[SPOILERS START]', ...body.slice(sp + 1, next), '[SPOILERS END]', ...body.slice(next)];
    }
  }

  // Scorecard: pull the table (or score list) out and leave a token where it sat.
  const scoreTable = parseScoreTable(body) ?? parseScoreList(body);
  if (scoreTable) {
    body = [...body.slice(0, scoreTable.start), '', SCORECARD_TOKEN, '', ...body.slice(scoreTable.end)];
  }

  // Total score fallback from prose ("My score: 88 out of 100", "The score: 88/100").
  let total = scoreTable?.total ?? headerTotal?.total ?? null;
  let max = scoreTable?.max ?? headerTotal?.max ?? 100;
  if (total == null) {
    const m = text.match(/score[^0-9\n]{0,20}(\d{1,3})\s*(?:\/|out of)\s*(\d{2,3})/i);
    if (m) { total = Number(m[1]); max = Number(m[2]); }
  }
  const score100 = total == null ? null : Math.round((total / max) * 100);

  // Split into ordinary and spoiler segments.
  const segments = [];
  let buf = [];
  let inSpoiler = false;
  for (const line of body) {
    const marker = spoilerMarker(line);
    if (marker === 'start' && !inSpoiler) {
      segments.push({ spoiler: false, md: buf.join('\n') });
      buf = []; inSpoiler = true; continue;
    }
    if (marker === 'end' && inSpoiler) {
      segments.push({ spoiler: true, md: buf.join('\n') });
      buf = []; inSpoiler = false; continue;
    }
    buf.push(line);
  }
  segments.push({ spoiler: inSpoiler, md: buf.join('\n') });

  // Render markdown, collecting h2s for the table of contents.
  const headings = [];
  const used = new Set();
  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({
    renderer: {
      heading({ tokens, depth, text: headingText }) {
        const inner = this.parser.parseInline(tokens);
        let id = slugify(stripMarkdown(headingText)) || 'section';
        while (used.has(id)) id += '-x';
        used.add(id);
        if (depth === 2) headings.push({ id, text: stripMarkdown(headingText) });
        const level = Math.min(Math.max(depth, 2), 4);
        return `<h${level} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${inner}</h${level}>\n`;
      },
    },
  });

  let spoilerCount = 0;
  const htmlParts = segments
    .filter((s) => s.md.trim())
    .map((s) => {
      let html = marked.parse(s.md);
      if (!s.spoiler) return html;
      spoilerCount++;
      const id = `spoilers-${spoilerCount}`;
      // One still inside the first curtain, about halfway through the spoiler text.
      if (spoilerCount === 1) {
        const ends = [...html.matchAll(/<\/p>/g)].map((m) => m.index + 4);
        if (ends.length >= 2) {
          const at = ends[Math.ceil(ends.length / 2) - 1];
          html = html.slice(0, at) + '\n' + STILL_TOKEN + '\n' + html.slice(at);
        }
      }
      return `
<section class="curtain" data-curtain>
  <button type="button" class="curtain__drape" aria-expanded="false" aria-controls="${id}">
    <span class="curtain__panel curtain__panel--left" aria-hidden="true"></span>
    <span class="curtain__panel curtain__panel--right" aria-hidden="true"></span>
    <span class="curtain__sign">
      <span class="curtain__eyebrow">Spoilers ahead</span>
      <span class="curtain__cta">Raise the curtain</span>
    </span>
  </button>
  <div class="curtain__stage" id="${id}" role="region" aria-label="Spoilers">
    ${html}
    <p class="curtain__end">End of spoilers</p>
  </div>
</section>`;
    });

  let html = htmlParts.join('\n');

  // Break points between sections, in the spoiler-free part only and never right before
  // the scorecard: a pull quote ~40% of the way in, and film stills before every other
  // remaining section. Inserted from the end so earlier offsets stay valid.
  {
    const firstCurtain = html.indexOf('<section class="curtain"');
    const safe = firstCurtain === -1 ? html : html.slice(0, firstCurtain);
    const h2s = [...safe.matchAll(/<h2 id=/g)].map((m) => m.index);
    const scoreAt = safe.indexOf(SCORECARD_TOKEN);
    const scoreH2 = scoreAt === -1 ? -1 : h2s.filter((i) => i < scoreAt).pop() ?? -1;
    const inserts = [];
    let quoteIdx = -1;
    if (pack.pullQuote && h2s.length >= 3) {
      quoteIdx = Math.ceil(h2s.length * 0.4);
      inserts.push({ at: h2s[quoteIdx], token: PULLQUOTE_TOKEN });
    }
    let toggle = false;
    for (let k = 1; k < h2s.length; k++) {
      const leadsIntoCurtain = firstCurtain !== -1 && k === h2s.length - 1;
      if (k === quoteIdx || k - 1 === quoteIdx || h2s[k] === scoreH2 || leadsIntoCurtain) { toggle = false; continue; }
      toggle = !toggle;
      if (toggle) inserts.push({ at: h2s[k], token: STILL_TOKEN });
    }
    for (const { at, token } of inserts.sort((a, b) => b.at - a.at)) {
      html = html.slice(0, at) + token + '\n' + html.slice(at);
    }
  }

  // Lede: the first paragraph of the body.
  const firstPara = body.join('\n').split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !/^[#|<]/.test(p));
  const plainBody = stripMarkdown(body.filter((l) => !/^\s*\|/.test(l)).join(' ').replace(/<!--.*?-->/g, ''));
  const words = plainBody.split(/\s+/).filter(Boolean).length;

  const slug = pack.slug || slugify(`${titleInfo.title} ${titleInfo.year ?? ''} review`);
  const tags = pack.tags.filter((t) => t.toLowerCase() !== titleInfo.title.toLowerCase());

  return {
    slug,
    title: titleInfo.title,
    year: titleInfo.year,
    headline: titleInfo.headline,
    fullHeadline: titleInfo.fullHeadline,
    headlineOptions: pack.headlines,
    metaDescription: pack.metaDescription || (firstPara ? stripMarkdown(firstPara).slice(0, 155) : ''),
    excerpt: pack.excerpt || (firstPara ? stripMarkdown(firstPara) : ''),
    lede: firstPara ? stripMarkdown(firstPara) : '',
    pullQuote: pack.pullQuote,
    ratingLine: pack.ratingLine,
    tags,
    genresFromPack: pack.genres,
    publishedText: pack.published,
    credits,
    creditsText: pack.creditsText,
    score: score100,
    rawTotal: total,
    rawMax: max,
    categories: scoreTable?.categories ?? [],
    html,
    headings,
    hasSpoilers: spoilerCount > 0,
    words,
    readMinutes: Math.max(1, Math.round(words / 238)),
  };
}
