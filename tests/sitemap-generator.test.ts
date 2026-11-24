import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';
import {
  SECTION_SUBTABS,
  SIDEBAR_NAV,
  TOP_NAV,
} from '../src/utils/navigationManifest.ts';
import {
  buildRobotsTxt,
  buildSitemapEntries,
  DEFAULT_PRODUCTION_SITE_URL,
  generateSitemap,
  resolveSitemapBaseUrl,
} from '../src/utils/sitemapGenerator.ts';

const execFileAsync = promisify(execFile);

describe('SEO Sitemap Generator', () => {
  it('indexes every public navigation section, top-nav alias, and non-default sub-section while excluding account', () => {
    const entries = buildSitemapEntries({
      baseUrl: 'https://rca-vostok.ru/',
      lastmod: '2026-11-24',
    });

    const urls = entries.map((e) => e.loc);
    const uniqueUrls = new Set(urls);
    assert.equal(urls.length, uniqueUrls.size, 'Sitemap URLs must be deduplicated');

    // Private workspace must stay out of sitemap
    assert.ok(!entries.some((e) => e.tab === 'account'));

    // Every TOP_NAV tab & alias should be present
    for (const item of TOP_NAV) {
      assert.ok(
        entries.some((e) => e.tab === item.id && !e.subTab),
        `Missing top-nav section: ${item.id}`
      );
      for (const alias of item.matches ?? []) {
        assert.ok(
          entries.some((e) => e.tab === alias && !e.subTab),
          `Missing top-nav alias: ${alias}`
        );
      }
    }

    // Every indexable SIDEBAR_NAV tab should be present
    for (const item of SIDEBAR_NAV) {
      if (item.indexable === false) continue;
      assert.ok(
        entries.some((e) => e.tab === item.id && !e.subTab),
        `Missing sidebar section: ${item.id}`
      );
    }

    // Every non-default sub-section from SECTION_SUBTABS must be indexed automatically
    for (const [tab, subTabs] of Object.entries(SECTION_SUBTABS)) {
      for (const sub of subTabs ?? []) {
        const present = entries.some((e) => e.tab === tab && e.subTab === sub.id);
        if (sub.isDefault) {
          assert.equal(present, false, `Default subTab ${tab}:${sub.id} should not duplicate parent URL`);
        } else {
          assert.equal(present, true, `Missing subTab URL for ${tab}:${sub.id}`);
        }
      }
    }

    // Verify expected concrete deep-links
    assert.ok(urls.includes('https://rca-vostok.ru/'));
    assert.ok(urls.includes('https://rca-vostok.ru/?tab=learning&sub=competencies'));
    assert.ok(urls.includes('https://rca-vostok.ru/?tab=certification&sub=registry'));
    assert.ok(urls.includes('https://rca-vostok.ru/?tab=calculator&sub=costs_budget'));
    assert.ok(urls.includes('https://rca-vostok.ru/?tab=market&sub=demand'));
    assert.ok(urls.includes('https://rca-vostok.ru/?tab=analytics&sub=seo'));
  });

  it('escapes XML ampersands cleanly and renders valid sitemap XML + robots.txt', () => {
    const result = generateSitemap({
      baseUrl: 'https://rca-vostok.ru',
      lastmod: '2026-11-24',
    });

    assert.ok(result.sectionCount >= 15);
    assert.ok(result.subSectionCount >= 18);
    assert.equal(result.entries.length, result.sectionCount + result.subSectionCount);
    assert.match(result.xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.match(result.xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
    assert.match(result.xml, /<loc>https:\/\/rca-vostok\.ru\/\?tab=learning&amp;sub=competencies<\/loc>/);
    assert.match(result.xml, /<lastmod>2026-11-24<\/lastmod>/);

    const robots = buildRobotsTxt(result.baseUrl);
    assert.match(robots, /Disallow: \/api\//);
    assert.match(robots, /Sitemap: https:\/\/rca-vostok\.ru\/sitemap\.xml/);
  });

  it('ignores placeholder APP_URL and strips trailing slashes', () => {
    const prev = process.env.APP_URL;
    try {
      process.env.APP_URL = 'MY_APP_URL';
      assert.equal(resolveSitemapBaseUrl(), DEFAULT_PRODUCTION_SITE_URL);
      assert.equal(resolveSitemapBaseUrl('https://example.ru///'), 'https://example.ru');
    } finally {
      if (prev === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = prev;
    }
  });

  it('generates sitemap.xml, robots.txt and manifest via CLI script', async () => {
    const tmpOut = await fs.mkdtemp(path.join(os.tmpdir(), 'rca-sitemap-cli-'));
    try {
      await execFileAsync('node', [
        'scripts/generate-sitemap.ts',
        '--out-dir',
        tmpOut,
        '--base-url',
        'https://rca-test.ru',
      ]);

      const [xml, robots, manifestRaw] = await Promise.all([
        fs.readFile(path.join(tmpOut, 'sitemap.xml'), 'utf8'),
        fs.readFile(path.join(tmpOut, 'robots.txt'), 'utf8'),
        fs.readFile(path.join(tmpOut, 'sitemap-manifest.json'), 'utf8'),
      ]);

      const manifest = JSON.parse(manifestRaw) as {
        baseUrl: string;
        totalUrls: number;
        sectionCount: number;
        subSectionCount: number;
      };

      assert.equal(manifest.baseUrl, 'https://rca-test.ru');
      assert.equal(manifest.totalUrls, manifest.sectionCount + manifest.subSectionCount);
      assert.match(xml, /https:\/\/rca-test\.ru\/\?tab=overview&amp;sub=monitoring/);
      assert.match(robots, /Sitemap: https:\/\/rca-test\.ru\/sitemap\.xml/);
    } finally {
      await fs.rm(tmpOut, { recursive: true, force: true });
    }
  });
});
