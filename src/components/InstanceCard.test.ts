import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import type { OdioInstance, OdioServerInfo } from '../lib/types';

vi.mock('../lib/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('../lib/api')>()),
	sendPowerAction: vi.fn(),
}));

vi.mock('../lib/state.svelte', () => ({
	appState: {
		openInstance: vi.fn(),
		removeInstance: vi.fn(),
		probeOne: vi.fn(),
		// needed when the inline AddInstanceForm is rendered (edit mode)
		updateInstance: vi.fn(),
	},
}));

import InstanceCard from './InstanceCard.svelte';
import { appState } from '../lib/state.svelte';
import { sendPowerAction } from '../lib/api';
import { mpdPlayer } from '../test/fixtures';

const serverInfo: OdioServerInfo = {
	hostname: 'raspi',
	os_platform: 'linux',
	os_version: '6.1',
	api_sw: 'odio-api',
	api_version: '1.0.0',
	backends: { mpris: true, pulseaudio: true, systemd: true, zeroconf: false },
};

const base: OdioInstance = { id: 'x', host: '192.168.1.1', port: 8080, status: 'online' };

beforeEach(() => vi.clearAllMocks());

// ── display name ──────────────────────────────────────────────────────────────

describe('InstanceCard — display name', () => {
	test('shows label when set', () => {
		render(InstanceCard, { instance: { ...base, label: 'Studio' } });
		expect(screen.getByText('Studio')).toBeInTheDocument();
	});

	test('falls back to serverInfo.hostname when no label', () => {
		render(InstanceCard, { instance: { ...base, serverInfo } });
		expect(screen.getByText('raspi')).toBeInTheDocument();
	});

	test('falls back to host:port when no label or hostname', () => {
		render(InstanceCard, { instance: base });
		expect(screen.getByRole('heading', { name: '192.168.1.1:8080' })).toBeInTheDocument();
	});
});

// ── status classes ────────────────────────────────────────────────────────────

describe('InstanceCard — status class', () => {
	test('online → status-online', () => {
		render(InstanceCard, { instance: { ...base, status: 'online' } });
		expect(screen.getByRole('article')).toHaveClass('status-online');
	});

	test('offline → status-offline', () => {
		render(InstanceCard, { instance: { ...base, status: 'offline' } });
		expect(screen.getByRole('article')).toHaveClass('status-offline');
	});

	test('probing → status-probing', () => {
		render(InstanceCard, { instance: { ...base, status: 'probing' } });
		expect(screen.getByRole('article')).toHaveClass('status-probing');
	});

	test('blocked → status-blocked', () => {
		render(InstanceCard, { instance: { ...base, status: 'blocked' } });
		expect(screen.getByRole('article')).toHaveClass('status-blocked');
	});
});

// ── status message ────────────────────────────────────────────────────────────

describe('InstanceCard — status message', () => {
	test('cors links "CORS headers" to the docs', () => {
		render(InstanceCard, { instance: { ...base, status: 'cors' } });
		const link = screen.getByRole('link', { name: 'CORS headers' });
		expect(link).toHaveAttribute('href', 'https://docs.odio.love/guides/pwa/#cors-on-each-node');
	});

	test('blocked links "mixed content" to the docs', () => {
		render(InstanceCard, { instance: { ...base, status: 'blocked' } });
		const link = screen.getByRole('link', { name: 'mixed content' });
		expect(link).toHaveAttribute('href', 'https://docs.odio.love/guides/pwa/#lan-access');
	});

	test('offline shows "Server unreachable"', () => {
		render(InstanceCard, { instance: { ...base, status: 'offline' } });
		expect(screen.getByText('Server unreachable')).toBeInTheDocument();
	});

	test('online shows no status message', () => {
		render(InstanceCard, { instance: { ...base, status: 'online' } });
		expect(screen.queryByText('Server unreachable')).not.toBeInTheDocument();
		expect(screen.queryByText(/blocked/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/CORS/i)).not.toBeInTheDocument();
	});
});

// ── server info line ──────────────────────────────────────────────────────────

describe('InstanceCard — server info', () => {
	test('shows api software and version when serverInfo is available', () => {
		render(InstanceCard, { instance: { ...base, serverInfo } });
		expect(screen.getByText(/odio-api 1\.0\.0/)).toBeInTheDocument();
	});

	test('hides server info line when not available', () => {
		render(InstanceCard, { instance: base });
		expect(screen.queryByText(/odio-api/)).not.toBeInTheDocument();
	});
});

// ── Connect button ────────────────────────────────────────────────────────────

describe('InstanceCard — Connect button', () => {
	test('enabled when online', () => {
		render(InstanceCard, { instance: { ...base, status: 'online' } });
		expect(screen.getByRole('button', { name: 'Connect' })).not.toBeDisabled();
	});

	test('disabled when offline', () => {
		render(InstanceCard, { instance: { ...base, status: 'offline' } });
		expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
	});

	test('disabled when probing', () => {
		render(InstanceCard, { instance: { ...base, status: 'probing' } });
		expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
	});

	test('enabled when cors — iframe loads even without API CORS headers', () => {
		render(InstanceCard, { instance: { ...base, status: 'cors' } });
		expect(screen.getByRole('button', { name: 'Connect' })).not.toBeDisabled();
	});

	test('disabled when blocked — mixed-content stops the iframe too', () => {
		render(InstanceCard, { instance: { ...base, status: 'blocked' } });
		expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
	});

	test('click calls appState.openInstance with the instance id', async () => {
		render(InstanceCard, { instance: base });
		await fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
		expect(appState.openInstance).toHaveBeenCalledWith('x');
	});
});

// ── action buttons ────────────────────────────────────────────────────────────

describe('InstanceCard — action buttons', () => {
	test('Delete calls appState.removeInstance with the instance id', async () => {
		render(InstanceCard, { instance: base });
		await fireEvent.click(screen.getByTitle('Delete'));
		expect(appState.removeInstance).toHaveBeenCalledWith('x');
	});

	test('Refresh calls appState.probeOne with the instance id', async () => {
		render(InstanceCard, { instance: base });
		await fireEvent.click(screen.getByTitle('Refresh'));
		expect(appState.probeOne).toHaveBeenCalledWith('x');
	});
});

// ── now playing ───────────────────────────────────────────────────────────────

describe('InstanceCard — now playing', () => {
	const mpd = mpdPlayer();

	test('shows the player block when online with an active player', () => {
		render(InstanceCard, { instance: { ...base, players: [mpd] } });
		expect(screen.getByRole('region', { name: 'Now playing' })).toBeInTheDocument();
	});

	test('hides it when the instance is not online', () => {
		render(InstanceCard, { instance: { ...base, status: 'offline', players: [mpd] } });
		expect(screen.queryByRole('region', { name: 'Now playing' })).not.toBeInTheDocument();
	});

	test('hides it without players', () => {
		render(InstanceCard, { instance: base });
		expect(screen.queryByRole('region', { name: 'Now playing' })).not.toBeInTheDocument();
	});
});

// ── inline edit ───────────────────────────────────────────────────────────────

describe('InstanceCard — inline edit', () => {
	test('clicking Edit replaces the card with the edit form', async () => {
		render(InstanceCard, { instance: { ...base, label: 'Studio' } });
		await fireEvent.click(screen.getByTitle('Edit'));
		expect(screen.getByRole('heading', { name: 'Edit Instance' })).toBeInTheDocument();
		expect(screen.queryByRole('article')).not.toBeInTheDocument();
	});

	test('cancelling the edit form brings the card back', async () => {
		render(InstanceCard, { instance: { ...base, label: 'Studio' } });
		await fireEvent.click(screen.getByTitle('Edit'));
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.getByRole('article')).toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: 'Edit Instance' })).not.toBeInTheDocument();
	});
});

// ── power off ─────────────────────────────────────────────────────────────────

describe('InstanceCard — power off', () => {
	const powerInfo: OdioServerInfo = {
		...serverInfo,
		backends: { ...serverInfo.backends, power: true },
	};
	const power = { reboot: true, power_off: true };

	test('shown when the power backend allows power off', () => {
		render(InstanceCard, { instance: { ...base, serverInfo: powerInfo, power } });
		expect(screen.getByTitle('Power off')).toBeInTheDocument();
	});

	test('hidden without the power backend', () => {
		render(InstanceCard, { instance: { ...base, serverInfo, power } });
		expect(screen.queryByTitle('Power off')).not.toBeInTheDocument();
	});

	test('hidden when login1 does not allow power off', () => {
		render(InstanceCard, {
			instance: { ...base, serverInfo: powerInfo, power: { ...power, power_off: false } },
		});
		expect(screen.queryByTitle('Power off')).not.toBeInTheDocument();
	});

	test('hidden until the capabilities are known', () => {
		render(InstanceCard, { instance: { ...base, serverInfo: powerInfo } });
		expect(screen.queryByTitle('Power off')).not.toBeInTheDocument();
	});

	test('hidden when the instance is not online', () => {
		render(InstanceCard, {
			instance: { ...base, status: 'offline', serverInfo: powerInfo, power },
		});
		expect(screen.queryByTitle('Power off')).not.toBeInTheDocument();
	});

	test('confirming keeps the name in the header', async () => {
		render(InstanceCard, { instance: { ...base, label: 'Salon', serverInfo: powerInfo, power } });
		await fireEvent.click(screen.getByTitle('Power off'), { detail: 1 });
		expect(screen.getByRole('alertdialog', { name: 'Power off Salon?' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Salon' })).toBeInTheDocument();
	});

	test('usable again once the instance went offline and came back', async () => {
		vi.mocked(sendPowerAction).mockResolvedValue();
		const instance: OdioInstance = { ...base, serverInfo: powerInfo, power };
		const { rerender } = render(InstanceCard, { instance });
		await fireEvent.click(screen.getByTitle('Power off'));
		await fireEvent.click(screen.getByRole('button', { name: 'Power off' }));
		expect(screen.getByTitle('Powering off…')).toBeDisabled();
		await rerender({ instance: { ...instance, status: 'offline' } });
		await rerender({ instance });
		expect(screen.getByTitle('Power off')).not.toBeDisabled();
	});
});
