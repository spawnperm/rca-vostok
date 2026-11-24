import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRobotsTxt,
  generateSitemap,
} from '../src/utils/sitemapGenerator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function parseArg(flag: string): string | undefined {
  const prefix = `--${flag}=`;
  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length).trim() || undefined;
    }
    if (arg === `--${flag}` && i + 1 < process.argv.length) {
      return process.argv[i + 1].trim() || undefined;
    }
  }
  return undefined;
}

async function main(): Promise<void> {
  const outDirArg = parseArg('out-dir') ?? 'dist';
  const baseUrlArg = parseArg('base-url');
  const targetDir = path.resolve(projectRoot, outDirArg);

  const result = generateSitemap({ baseUrl: baseUrlArg });
  const robotsTxt = buildRobotsTxt(result.baseUrl);

  await fs.mkdir(targetDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(targetDir, 'sitemap.xml'), result.xml, 'utf8'),
    fs.writeFile(path.join(targetDir, 'robots.txt'), robotsTxt, 'utf8'),
    fs.writeFile(
      path.join(targetDir, 'sitemap-manifest.json'),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          baseUrl: result.baseUrl,
          totalUrls: result.entries.length,
          sectionCount: result.sectionCount,
          subSectionCount: result.subSectionCount,
          entries: result.entries.map((entry) => ({
            tab: entry.tab,
            ...(entry.subTab ? { subTab: entry.subTab } : {}),
            source: entry.source,
            label: entry.label,
            loc: entry.loc,
            priority: entry.priority,
            changefreq: entry.changefreq,
          })),
        },
        null,
        2
      ) + '\n',
      'utf8'
    ),
  ]);

  console.log(
    `[sitemap] Generated ${result.entries.length} URLs (${result.sectionCount} sections, ${result.subSectionCount} sub-sections) -> ${path.relative(projectRoot, targetDir)}/sitemap.xml (base: ${result.baseUrl})`
  );
}

main().catch((err) => {
  console.error('[sitemap] Failed to generate sitemap.xml:', err);
  process.exit(1);
});
