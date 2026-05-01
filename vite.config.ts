import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { version as pkgVersion } from './package.json';

function gitDescribe(): string | null {
	try {
		const raw = execSync('git describe --tags', { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
		// v0.3.4 → 0.3.4 ; v0.3.4-1-g838e075 → 0.3.4+1.g838e075 (semver build-meta)
		const m = raw.match(/^v?(\d+\.\d+\.\d+)(?:-(\d+)-g([0-9a-f]+))?$/);
		if (!m) return null;
		const [, tag, count, sha] = m;
		return count ? `${tag}+${count}.g${sha}` : tag;
	} catch {
		return null;
	}
}

const appVersion = process.env.APP_VERSION ?? gitDescribe() ?? pkgVersion;

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(appVersion),
	},
	plugins: [
		svelte(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
			manifest: {
				name: 'Odio - Multimedia Remote Controller',
				short_name: 'Odio',
				description: 'Discover and control odio-api instances on your local network',
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
			},
			devOptions: {
				enabled: true,
			},
		}),
	],
});
