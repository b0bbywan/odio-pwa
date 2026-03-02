import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import type { OdioInstance, OdioServerInfo } from '../lib/types';

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
