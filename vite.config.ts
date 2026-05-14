import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { version as pkgVersion } from './package.json';
import {
	buildSiteSchema,
	DEFAULT_TITLE,
	DEFAULT_DESCRIPTION,
	SHORT_DESCRIPTION,
	OG_IMAGE,
	OG_IMAGE_ALT,
	SITE_URL,
} from './src/data/schemas/site';

function buildRobotsTxt(): string {
	return [
		'User-agent: *',
		'Content-Signal: search=yes, ai-input=yes, ai-train=yes',
		'Allow: /',
		`Sitemap: ${SITE_URL}/sitemap.xml`,
		'',
	].join('\n');
}

function buildSitemapXml(): string {
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		'  <url>',
		`    <loc>${SITE_URL}/</loc>`,
		'    <changefreq>monthly</changefreq>',
		'    <priority>1.0</priority>',
		'  </url>',
		'</urlset>',
		'',
	].join('\n');
}

function seoPlugin(): Plugin {
	const jsonLd = JSON.stringify(buildSiteSchema({ version: pkgVersion }));
	const replacements: Record<string, string> = {
		'%TITLE%': DEFAULT_TITLE,
		'%DESCRIPTION%': DEFAULT_DESCRIPTION,
		'%SHORT_DESCRIPTION%': SHORT_DESCRIPTION,
		'%OG_IMAGE%': OG_IMAGE,
		'%OG_IMAGE_ALT%': OG_IMAGE_ALT,
		'%JSON_LD%': jsonLd,
	};
	const generated: Record<string, { body: string; type: string }> = {
		'/robots.txt': { body: buildRobotsTxt(), type: 'text/plain; charset=utf-8' },
		'/sitemap.xml': { body: buildSitemapXml(), type: 'application/xml; charset=utf-8' },
	};
	return {
		name: 'odio-seo',
		transformIndexHtml: {
			order: 'pre',
			handler(html) {
				return html.replace(
					/%(TITLE|DESCRIPTION|SHORT_DESCRIPTION|OG_IMAGE|OG_IMAGE_ALT|JSON_LD)%/g,
					(m) => replacements[m] ?? m,
				);
			},
		},
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const url = req.url?.split('?')[0];
				const hit = url ? generated[url] : undefined;
				if (!hit) return next();
				res.setHeader('Content-Type', hit.type);
				res.end(hit.body);
			});
		},
		generateBundle() {
			// Only emit on the Vercel build that serves pwa.odio.love.
			// Self-hoster zips / Docker images must not ship a robots.txt or
			// sitemap.xml that points at pwa.odio.love.
			if (process.env.VERCEL !== '1') return;
			this.emitFile({ type: 'asset', fileName: 'robots.txt', source: generated['/robots.txt'].body });
			this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: generated['/sitemap.xml'].body });
		},
	};
}

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(pkgVersion),
	},
	plugins: [
		svelte(),
		seoPlugin(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
			manifest: {
				name: 'Odio - Multimedia Remote Controller',
				short_name: 'Odio',
				description: SHORT_DESCRIPTION,
				lang: 'en',
				dir: 'ltr',
				categories: ['music', 'utilities', 'productivity'],
				theme_color: '#0a1f12',
				background_color: '#0a1f12',
				display: 'standalone',
				scope: '/',
				start_url: '/',
				icons: [
					{
						src: 'pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png',
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
				navigateFallback: 'index.html',
				navigateFallbackDenylist: [
					/^\/robots\.txt$/,
					/^\/sitemap\.xml$/,
					/^\/llms\.txt$/,
				],
			},
			devOptions: {
				enabled: true,
			},
		}),
	],
});
