import { defineConfig } from 'vite';

// Relative asset paths so the build works both at a site root and under
// GitHub Pages' /moebius/ sub-path.
export default defineConfig({
  base: './',
});
