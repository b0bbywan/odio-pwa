import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { writable, type Writable } from 'svelte/store';
import ReloadPrompt from './ReloadPrompt.svelte';

let offlineReady: Writable<boolean>;
let needRefresh: Writable<boolean>;
let updateServiceWorker: (reloadPage?: boolean) => Promise<void>;

beforeEach(() => {
	offlineReady = writable(false);
	needRefresh = writable(false);
	updateServiceWorker = vi.fn(async () => {});
});

function renderPrompt() {
	return render(ReloadPrompt, { offlineReady, needRefresh, updateServiceWorker });
}

// ── hidden state ──────────────────────────────────────────────────────────────

describe('ReloadPrompt — hidden', () => {
	test('renders nothing when neither flag is set', () => {
		renderPrompt();
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});
});

// ── offline ready ─────────────────────────────────────────────────────────────

describe('ReloadPrompt — offline ready', () => {
	beforeEach(() => {
		offlineReady.set(true);
	});

	test('shows the offline-ready toast', () => {
		renderPrompt();
		expect(screen.getByRole('alert')).toBeInTheDocument();
		expect(screen.getByText('App ready to work offline')).toBeInTheDocument();
	});

	test('does not show the Reload button (no update available)', () => {
		renderPrompt();
		expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();
	});

	test('shows the Close button', () => {
		renderPrompt();
		expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
	});
});

// ── update available ──────────────────────────────────────────────────────────

describe('ReloadPrompt — update available', () => {
	beforeEach(() => {
		needRefresh.set(true);
	});

	test('shows the new-content toast', () => {
		renderPrompt();
		expect(screen.getByRole('alert')).toBeInTheDocument();
		expect(screen.getByText('New content available')).toBeInTheDocument();
	});

	test('Reload button calls updateServiceWorker(true)', async () => {
		renderPrompt();
		await fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
		expect(updateServiceWorker).toHaveBeenCalledWith(true);
	});

	test('shows the Close button alongside Reload', () => {
		renderPrompt();
		expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
	});
});

// ── close ─────────────────────────────────────────────────────────────────────

describe('ReloadPrompt — close', () => {
	test('Close clears both stores and hides the toast', async () => {
		offlineReady.set(true);
		needRefresh.set(true);
		renderPrompt();
		await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});
});
