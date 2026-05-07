import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ConnectionStatusScreen from './ConnectionStatusScreen.svelte';

const noop = () => {};

function renderScreen(overrides: Partial<{
	status: 'probing' | 'unknown' | 'offline' | 'blocked';
	displayName: string;
	host: string;
	port: number;
	onback: () => void;
}> = {}) {
	return render(ConnectionStatusScreen, {
		status: 'probing',
		displayName: 'Pi',
		host: '192.168.1.10',
		port: 8018,
		onback: noop,
		...overrides,
	});
}

// ── probing ───────────────────────────────────────────────────────────────────

describe('ConnectionStatusScreen — probing', () => {
	test('shows "Connecting to {displayName}" with host:port', () => {
		renderScreen({ status: 'probing', displayName: 'Living Room', host: 'odio.local', port: 9000 });
		expect(screen.getByText(/Connecting to Living Room/)).toBeInTheDocument();
		expect(screen.getByText('odio.local:9000')).toBeInTheDocument();
	});

	test('"unknown" status renders the same Connecting view', () => {
		renderScreen({ status: 'unknown' });
		expect(screen.getByText(/Connecting to/)).toBeInTheDocument();
	});

	test('back button calls onback', async () => {
		const onback = vi.fn();
		renderScreen({ status: 'probing', onback });
		await fireEvent.click(screen.getByRole('button', { name: /back to list/i }));
		expect(onback).toHaveBeenCalledOnce();
	});
});

// ── offline ───────────────────────────────────────────────────────────────────

describe('ConnectionStatusScreen — offline', () => {
	test('shows "Server unreachable" with host:port', () => {
		renderScreen({ status: 'offline', host: '192.168.1.99', port: 8018 });
		expect(screen.getByText('Server unreachable')).toBeInTheDocument();
		expect(screen.getByText(/192.168.1.99:8018 did not respond/)).toBeInTheDocument();
	});

	test('back button calls onback', async () => {
		const onback = vi.fn();
		renderScreen({ status: 'offline', onback });
		await fireEvent.click(screen.getByRole('button', { name: /back to list/i }));
		expect(onback).toHaveBeenCalledOnce();
	});
});

// ── blocked ───────────────────────────────────────────────────────────────────

describe('ConnectionStatusScreen — blocked', () => {
	test('shows "Browser blocked" with a link to the mixed-content guide', () => {
		renderScreen({ status: 'blocked', host: '192.168.1.10', port: 8018 });
		expect(screen.getByText('Browser blocked the request')).toBeInTheDocument();
		const link = screen.getByRole('link', { name: /mixed content/i });
		expect(link).toHaveAttribute('href', expect.stringContaining('docs.odio.love'));
		expect(link).toHaveAttribute('target', '_blank');
		expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
	});

	test('back button calls onback', async () => {
		const onback = vi.fn();
		renderScreen({ status: 'blocked', onback });
		await fireEvent.click(screen.getByRole('button', { name: /back to list/i }));
		expect(onback).toHaveBeenCalledOnce();
	});
});
