import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const commit = (() => { try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } })();

// npm run build         → dist/    static site (GitHub Pages / Vercel): data/*.json loaded at runtime
// npm run build:single  → single/  one self-contained HTML file (data inlined), for previews
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    publicDir: single ? false : 'public',
    resolve: { alias: { '@data-source': here(single ? './src/core/data-inline.ts' : './src/core/data-fetch.ts') } },
    define: {
      __BUILD__: JSON.stringify({ time: new Date().toISOString(), commit }),
      __API__: JSON.stringify(process.env.VITE_API || 'https://financial-duel-api.maxwei6699.workers.dev'),
    },
    build: {
      outDir: single ? 'single' : 'dist',
      emptyOutDir: true,
      target: 'es2022',
      assetsInlineLimit: single ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 2000,
    },
    plugins: single ? [viteSingleFile()] : [],
    test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  };
});
