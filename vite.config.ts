import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		svelte(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
			manifest: {
				name: 'odio - Network Audio Controller',
				short_name: 'odio',
				description: 'Discover and control odio-api instances on your local network',
				theme_color: '#1a1a2e',
				background_color: '#1a1a2e',
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
