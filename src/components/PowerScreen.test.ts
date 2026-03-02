import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import PowerScreen from './PowerScreen.svelte';

const noop = () => {};

// ── reboot ────────────────────────────────────────────────────────────────────

describe('PowerScreen — reboot', () => {
	test('shows the waiting screen immediately', () => {
		render(PowerScreen, { event: 'reboot', waiting: false, onstartwaiting: noop, ondismiss: noop });
		expect(screen.getByText('Server is rebooting')).toBeInTheDocument();
		expect(screen.getByText(/Waiting for comeback/)).toBeInTheDocument();
	});

	test('shows no action buttons (auto-reconnects)', () => {
		render(PowerScreen, { event: 'reboot', waiting: false, onstartwaiting: noop, ondismiss: noop });
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});
});

// ── poweroff — choice ─────────────────────────────────────────────────────────

describe('PowerScreen — poweroff choice', () => {
	test('asks whether to wait or go back', () => {
		render(PowerScreen, { event: 'poweroff', waiting: false, onstartwaiting: noop, ondismiss: noop });
		expect(screen.getByText('Server is shutting down')).toBeInTheDocument();
		expect(screen.getByText(/wait for it to come back/)).toBeInTheDocument();
	});

	test('"Wait" button calls onstartwaiting', async () => {
		const onstartwaiting = vi.fn();
		render(PowerScreen, { event: 'poweroff', waiting: false, onstartwaiting, ondismiss: noop });
		await fireEvent.click(screen.getByRole('button', { name: 'Wait' }));
		expect(onstartwaiting).toHaveBeenCalledOnce();
	});

	test('"Back to list" button calls ondismiss', async () => {
		const ondismiss = vi.fn();
		render(PowerScreen, { event: 'poweroff', waiting: false, onstartwaiting: noop, ondismiss });
		await fireEvent.click(screen.getByRole('button', { name: /back to list/i }));
		expect(ondismiss).toHaveBeenCalledOnce();
	});
});

// ── poweroff — waiting ────────────────────────────────────────────────────────

describe('PowerScreen — poweroff waiting', () => {
	test('shows the waiting screen after user chose to wait', () => {
		render(PowerScreen, { event: 'poweroff', waiting: true, onstartwaiting: noop, ondismiss: noop });
		expect(screen.getByText('Server is shutting down')).toBeInTheDocument();
		expect(screen.getByText(/Waiting for comeback/)).toBeInTheDocument();
	});

	test('shows no action buttons once waiting', () => {
		render(PowerScreen, { event: 'poweroff', waiting: true, onstartwaiting: noop, ondismiss: noop });
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});
});
