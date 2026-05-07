import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { version as pkgVersion } from './package.json';

function runDescribe(): string {
	return execSync('git describe --tags --always --dirty', { stdio: ['ignore', 'pipe', 'ignore'] })
		.toString()
		.trim();
}

function gitDescribe(): string | null {
	try {
		let raw = runDescribe();
		// Vercel ships a shallow clone without tag refs, so describe falls back
		// to a bare SHA. Fetch tags once and retry so a release commit shows as
		// just "v0.5.0" instead of "v0.5.0+gSHA".
		if (raw && /^[0-9a-f]+(-dirty)?$/.test(raw)) {
			try {
				execSync('git fetch --tags --depth=1 origin', { stdio: 'ignore' });
				raw = runDescribe();
			} catch {}
		}
		if (!raw) return null;
		// v0.3.4 → 0.3.4
		// v0.3.4-1-g838e075 → 0.3.4+1.g838e075 (semver build-meta)
		// + optional -dirty suffix on either of the above
		const tagged = raw.match(/^v?(\d+\.\d+\.\d+)(?:-(\d+)-g([0-9a-f]+))?(-dirty)?$/);
		if (tagged) {
			const [, tag, count, sha, dirty] = tagged;
			const base = count ? `${tag}+${count}.g${sha}` : tag;
			return dirty ? `${base}.dirty` : base;
		}
		// Tag fetch didn't help (network blocked, or HEAD genuinely past the
		// last reachable tag): pair the bare SHA with the package.json version.
		const sha = raw.match(/^([0-9a-f]+)(-dirty)?$/);
		if (sha) return `${pkgVersion}+g${sha[1]}${sha[2] ? '.dirty' : ''}`;
		return null;
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
