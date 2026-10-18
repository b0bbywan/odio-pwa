import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('svelte-spa-router', () => ({ replace: vi.fn() }));

import { initHistory, goHome, showInFrame } from './nav';
import { replace } from 'svelte-spa-router';

// Resolves on the next popstate, i.e. once a history traversal has landed.
const popped = () => new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));

beforeEach(() => {
	vi.clearAllMocks();
	history.replaceState(null, '', '/');
});

describe('initHistory', () => {
	test('landing on an instance slips the list in below it', async () => {
		history.replaceState(null, '', '/#/i/raspodio.local');
		const before = history.length;
		initHistory();
		expect(location.hash).toBe('#/i/raspodio.local');
		expect(history.length).toBe(before + 1);

		const landed = popped();
		history.back();
		await landed;
		expect(location.hash).toBe('#/');
	});

	test('landing on the list adds no entry', () => {
		history.replaceState(null, '', '/#/');
		const before = history.length;
		initHistory();
		expect(history.length).toBe(before);
		expect(history.state.odioEntry).toBe(true);
	});

	test('a reload on an instance adds no entry: the list is already below', () => {
		history.replaceState({ odioEntry: true }, '', '/#/i/raspodio.local');
		const before = history.length;
		initHistory();
		expect(history.length).toBe(before);
		expect(location.hash).toBe('#/i/raspodio.local');
	});

	test('marks the entries the app navigates to', () => {
		initHistory();
		history.pushState(null, '', '/#/i/raspodio.local');
		window.dispatchEvent(new HashChangeEvent('hashchange'));
		expect(history.state.odioEntry).toBe(true);
	});
});

describe('showInFrame', () => {
	test('replaces the frame location, adding no history entry', () => {
		const replaceUrl = vi.fn();
		const frame = { contentWindow: { location: { replace: replaceUrl } } } as unknown as HTMLIFrameElement;
		showInFrame(frame, 'http://raspodio.local:8018/ui');
		expect(replaceUrl).toHaveBeenCalledWith('http://raspodio.local:8018/ui');
	});
});

describe('goHome', () => {
	const entry = (key: string, hash: string) => ({ key, url: `https://pwa.odio.love/${hash}` });

	afterEach(() => {
		delete (window as { navigation?: unknown }).navigation;
	});

	function fakeNavigation(entries: ReturnType<typeof entry>[], index: number) {
		const traverseTo = vi.fn();
		Object.defineProperty(window, 'navigation', {
			configurable: true,
			value: { entries: () => entries, currentEntry: { index }, traverseTo },
		});
		return traverseTo;
	}

	test('traverses back to the last list entry, past the instances in between', () => {
		const traverseTo = fakeNavigation(
			[entry('a', '#/'), entry('b', '#/i/one'), entry('c', '#/'), entry('d', '#/i/two'), entry('e', '#/i/three')],
			4,
		);
		goHome();
		expect(traverseTo).toHaveBeenCalledWith('c');
		expect(replace).not.toHaveBeenCalled();
	});

	test('ignores list entries ahead of the current one', () => {
		const traverseTo = fakeNavigation([entry('a', ''), entry('b', '#/i/one'), entry('c', '#/')], 1);
		goHome();
		expect(traverseTo).toHaveBeenCalledWith('a');
	});

	test('replaces the current entry when no list entry is behind', () => {
		const traverseTo = fakeNavigation([entry('a', '#/i/one')], 0);
		goHome();
		expect(traverseTo).not.toHaveBeenCalled();
		expect(replace).toHaveBeenCalledWith('/');
	});

	test('replaces the current entry without the Navigation API', () => {
		goHome();
		expect(replace).toHaveBeenCalledWith('/');
	});
});
