import { defineConfig } from 'astro/config';

// Published on GitHub Pages as a project site under the account's custom domain:
// https://www.johnathanmargheret.com/margherets-movies
// (spartanmods.github.io/margherets-movies redirects there.)
export default defineConfig({
  site: 'https://www.johnathanmargheret.com',
  base: '/margherets-movies',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
