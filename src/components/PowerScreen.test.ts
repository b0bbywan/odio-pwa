import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/svelte';
import PowerScreen from './PowerScreen.svelte';

// ── reboot ────────────────────────────────────────────────────────────────────

describe('PowerScreen — reboot', () => {
	test('shows rebooting title and waiting body', () => {
		render(PowerScreen, { event: 'reboot', serverBack: false, onreconnect: vi.fn(), ondismiss: vi.fn() });
		expect(screen.getByText('Server is rebooting')).toBeInTheDocument();
		expect(screen.getByText(/Waiting for comeback/)).toBeInTheDocument();
	});

	test('shows no action buttons (auto-reconnects, no user input needed)', () => {
		render(PowerScreen, { event: 'reboot', serverBack: false, onreconnect: vi.fn(), ondismiss: vi.fn() });
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});
});

// ── poweroff ──────────────────────────────────────────────────────────────────

describe('PowerScreen — poweroff', () => {
	test('shows shutting down title and body', () => {
		render(PowerScreen, { event: 'poweroff', serverBack: false, onreconnect: vi.fn(), ondismiss: vi.fn() });
		expect(screen.getByText('Server is shutting down')).toBeInTheDocument();
		expect(screen.getByText(/powered off/)).toBeInTheDocument();
	});

	test('"Back to list" button calls ondismiss', async () => {
		const ondismiss = vi.fn();
		render(PowerScreen, { event: 'poweroff', serverBack: false, onreconnect: vi.fn(), ondismiss });
		await fireEvent.click(screen.getByRole('button', { name: /back to list/i }));
		expect(ondismiss).toHaveBeenCalledOnce();
	});
});

// ── poweroff + server came back ───────────────────────────────────────────────

describe('PowerScreen — poweroff with serverBack', () => {
	test('shows "Server is back online"', () => {
		render(PowerScreen, { event: 'poweroff', serverBack: true, onreconnect: vi.fn(), ondismiss: vi.fn() });
		expect(screen.getByText('Server is back online')).toBeInTheDocument();
	});

	test('"Reconnect" button calls onreconnect', async () => {
		const onreconnect = vi.fn();
		render(PowerScreen, { event: 'poweroff', serverBack: true, onreconnect, ondismiss: vi.fn() });
		await fireEvent.click(screen.getByRole('button', { name: /reconnect/i }));
		expect(onreconnect).toHaveBeenCalledOnce();
	});

	test('"Back to list" button calls ondismiss', async () => {
		const ondismiss = vi.fn();
		render(PowerScreen, { event: 'poweroff', serverBack: true, onreconnect: vi.fn(), ondismiss });
		await fireEvent.click(screen.getByRole('button', { name: /back to list/i }));
		expect(ondismiss).toHaveBeenCalledOnce();
	});
});
