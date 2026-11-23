import { defineConfig } from 'astro/config';

// Published on GitHub Pages as a project site:
// https://spartanmods.github.io/margherets-movies
// If you add a custom domain later, set `site` to it and `base` to '/'.
export default defineConfig({
  site: 'https://spartanmods.github.io',
  base: '/margherets-movies',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
