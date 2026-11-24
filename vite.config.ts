import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import {buildRobotsTxt, generateSitemap} from './src/utils/sitemapGenerator.ts';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
      // Generates dist/sitemap.xml, dist/robots.txt, and dist/sitemap-manifest.json
      // automatically from navigation definitions on every production build.
      {
        name: 'generate-seo-sitemap',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          if (!fs.existsSync(distDir)) {
            return;
          }
          const result = generateSitemap();
          fs.writeFileSync(path.join(distDir, 'sitemap.xml'), result.xml, 'utf8');
          fs.writeFileSync(path.join(distDir, 'robots.txt'), buildRobotsTxt(result.baseUrl), 'utf8');
          fs.writeFileSync(
            path.join(distDir, 'sitemap-manifest.json'),
            JSON.stringify(
              {
                generatedAt: new Date().toISOString(),
                baseUrl: result.baseUrl,
                totalUrls: result.entries.length,
                sectionCount: result.sectionCount,
                subSectionCount: result.subSectionCount,
                entries: result.entries,
              },
              null,
              2,
            ) + '\n',
            'utf8',
          );
          console.log(
            `[vite:seo] Generated dist/sitemap.xml (${result.entries.length} URLs: ${result.sectionCount} sections, ${result.subSectionCount} sub-sections)`,
          );
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
