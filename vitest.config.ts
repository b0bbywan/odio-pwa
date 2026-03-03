import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { version } from './package.json';

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(version),
	},
	plugins: [svelte({ hot: false }), svelteTesting()],
	test: {
		environment: 'jsdom',
		globals: true,
		include: ['src/**/*.test.ts'],
		setupFiles: ['./vitest-setup.ts'],
	},
});
