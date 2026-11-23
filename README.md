# Margheret's Movies

A movie palace for long-form reviews. Dark cinematic theme with marquee lights, velvet-curtain spoilers, a scorecard for every film, a Hall of Fame and search.

Live site (once GitHub Pages is on): https://spartanmods.github.io/margherets-movies

## Posting a review

1. Write the review the usual way (the movie-critic skill's format, Publish pack and all).
2. Drop the `.md` file into the [`reviews/`](reviews/) folder. Keep the file name as it is.
3. Commit and push to `main` with GitHub Desktop. The site rebuilds itself in about a minute.

That's it. The site reads the file directly:

| In your file | On the site |
| --- | --- |
| `# Title (Year) Review: Headline` | Title, year and headline in the hero |
| First paragraph | The lede, with a marquee drop cap |
| `## Section` headings | Article sections and the "In this review" sidebar |
| `[SPOILERS START]` ... `[SPOILERS END]` | Hidden behind a velvet curtain readers click to raise |
| The score table (`Category \| 18/20`, `Total \| 88/100`) | The scorecard: marquee score, palace tier and color-graded bars |
| Publish pack: URL slug | The page address, `/reviews/<slug>/` |
| Publish pack: meta description, excerpt | Search and social previews, the dek under the hero |
| Publish pack: pull quote | A big pull quote partway through the article |
| Publish pack: tags | Tag chips (they link to search), genre fallback |
| Publish pack: credits | The "Admit One" ticket in the sidebar |

The Publish pack itself never shows on the page.

Optional extras you can add to the Publish pack:

- `Published: November 22, 2026` sets the date shown. Otherwise the date the file was first committed is used.
- `Genres: Drama, Family` overrides the genres from TMDB.

## Coming Attractions

Edit [`src/data/coming-attractions.json`](src/data/coming-attractions.json). Add a year when the title is ambiguous. A film disappears from the list automatically once its review is published.

## Posters and backdrops (TMDB)

Posters, backdrop stills and genres come from [The Movie Database](https://www.themoviedb.org/). Without a key, every film gets a designed marquee title card instead.

1. Create a free TMDB account, then request an API key at https://www.themoviedb.org/settings/api.
2. Add it to GitHub: repo **Settings > Secrets and variables > Actions > New repository secret**, name `TMDB_API_KEY`.
3. For local previews, copy `.env.example` to `.env` and paste the key there. `.env` is git-ignored.

Running `npm run fetch-movies` locally saves the images into `public/tmdb/` and details into `src/data/tmdb-cache.json`. Commit those, and the live site never has to look them up again.

## One-time GitHub Pages setup

In the repo on GitHub: **Settings > Pages > Build and deployment > Source: GitHub Actions**. After that, every push to `main` deploys. (Free GitHub Pages needs the repo to be public.)

## Working on the site locally

```powershell
npm install
npm run dev
```

Then open http://localhost:4321/margherets-movies/. `npm run build` does a full production build into `dist/`.

## Where things live

- `reviews/` holds your review files
- `src/lib/parse-review.js` turns a review file into page data
- `src/lib/tiers.js` sets the palace tiers and their cut-offs
- `src/lib/rubric.js` holds the five scoring categories and their descriptions
- `src/styles/global.css` contains the whole look: colors, marquee bulbs, curtain
- `src/pages/` has one file per page
- `scripts/` holds the TMDB fetcher and the social share card generator
