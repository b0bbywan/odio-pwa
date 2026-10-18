import { replace } from 'svelte-spa-router';

// Set on every history entry of the app, so a reload can tell its own
// entries from a fresh landing.
const MARK = 'odioEntry';

function isListHash(hash: string): boolean {
	return hash === '' || hash === '#' || hash === '#/';
}

function mark(): void {
	if (history.state?.[MARK]) return;
	history.replaceState({ ...history.state, [MARK]: true }, '');
}

/**
 * Landing straight on an instance (shared link, shortcut, link from an
 * odio-api UI) slips the list in below it, so back leads to the list rather
 * than out of the app. Call once, before the router reads the location.
 */
export function initHistory(): void {
	if (!history.state?.[MARK] && !isListHash(location.hash)) {
		const target = location.hash;
		history.replaceState({ ...history.state, [MARK]: true }, '', '#/');
		history.pushState({ [MARK]: true }, '', target);
	} else {
		mark();
	}
	window.addEventListener('hashchange', mark);
}

/**
 * Straight to the list, past every page in between. It goes back to the last
 * list entry rather than pushing a new one, so back from there still leaves
 * the app instead of reopening an instance.
 */
export function goHome(): void {
	if ('navigation' in window && navigation.currentEntry) {
		const list = navigation
			.entries()
			.slice(0, navigation.currentEntry.index)
			.reverse()
			.find((e) => e.url && isListHash(new URL(e.url).hash));
		if (list) {
			navigation.traverseTo(list.key);
			return;
		}
	}
	replace('/');
}

/**
 * Brings the iframe back to `url` (the instance UI) from wherever it went,
 * myMPD or the admin app. Replaces its current entry rather than adding one;
 * allowed on a cross-origin frame since the app is its parent.
 */
export function showInFrame(frame: HTMLIFrameElement, url: string): void {
	frame.contentWindow?.location.replace(url);
}
