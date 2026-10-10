import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import type { OdioInstance } from '../lib/types';
import type { ScanResult } from '../lib/scan';

vi.mock('../lib/state.svelte', () => ({
	appState: {
		addInstance: vi.fn(),
		findByHostPort: vi.fn(),
	},
}));

import ScanResults from './ScanResults.svelte';
import { appState } from '../lib/state.svelte';

const result = (host: string, hostname: string): ScanResult => ({
	host,
	info: {
		hostname,
		os_platform: 'linux',
		os_version: '6.1',
		api_sw: 'odio-api',
		api_version: '1.4.0',
		backends: { mpris: true, pulseaudio: true, systemd: true, zeroconf: false },
	},
});

const salon = result('192.168.1.23', 'raspi-salon');
const kitchen = result('192.168.1.57', 'kitchen');

beforeEach(() => vi.resetAllMocks());

describe('ScanResults', () => {
	test('lists each instance with its address and version', () => {
		render(ScanResults, { results: [salon, kitchen], port: 8018 });
		expect(screen.getByText('raspi-salon')).toBeInTheDocument();
		expect(screen.getByText('192.168.1.23 · odio-api 1.4.0')).toBeInTheDocument();
		expect(screen.getByText('kitchen')).toBeInTheDocument();
	});

	test('"Add" adds the instance on the scanned port', async () => {
		render(ScanResults, { results: [salon], port: 8080 });
		await fireEvent.click(screen.getByRole('button', { name: 'Add' }));
		expect(appState.addInstance).toHaveBeenCalledExactlyOnceWith('192.168.1.23', 8080);
	});

	test('an instance already in the list gets a check instead of "Add"', () => {
		vi.mocked(appState.findByHostPort).mockImplementation((host, port) =>
			host === '192.168.1.57' && port === 8018 ? ({ id: 'k' } as OdioInstance) : undefined,
		);
		render(ScanResults, { results: [salon, kitchen], port: 8018 });
		expect(screen.getByRole('img', { name: 'Already added' })).toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: 'Add' })).toHaveLength(1);
	});
});
