import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import type { OdioInstance, OdioServerInfo } from '../lib/types';

vi.mock('../lib/state.svelte', () => ({
	appState: {
		instances: [] as OdioInstance[],
		addInstance: vi.fn(),
		findByHostPort: vi.fn(),
	},
}));

// The network probes are mocked; the Scanner driving them is the real one.
vi.mock('../lib/scan', async (importOriginal) => ({
	...(await importOriginal<typeof import('../lib/scan')>()),
	findActiveNetworks: vi.fn(),
	scanHosts: vi.fn(),
}));

import ScanModal from './ScanModal.svelte';
import { appState } from '../lib/state.svelte';
import { findActiveNetworks, scanHosts, type ScanResult } from '../lib/scan';

const info = (hostname: string): OdioServerInfo => ({
	hostname,
	os_platform: 'linux',
	os_version: '6.1',
	api_sw: 'odio-api',
	api_version: '1.4.0',
	backends: { mpris: true, pulseaudio: true, systemd: true, zeroconf: false },
});

const kitchen: OdioInstance = { id: 'k', host: '192.168.1.57', port: 8018, label: 'kitchen', status: 'online' };
const salon: ScanResult = { host: '192.168.1.23', info: info('raspi-salon') };
const bureau: ScanResult = { host: '192.168.1.142', info: info('bureau') };

// scanHosts reports these hosts, `blocked` others as refusing this origin,
// then the whole list as probed.
function scanFinds(found: ScanResult[] = [], blocked = 0) {
	vi.mocked(scanHosts).mockImplementation(async (hosts, _port, { onFound, onBlocked, onProgress }) => {
		found.forEach(onFound);
		for (let i = 0; i < blocked; i++) onBlocked?.(`192.168.1.${200 + i}`);
		onProgress(hosts.length);
	});
}

const target = () => screen.getByPlaceholderText('192.168.1.0/24');

// Scans 192.168.1.0/24 to the end.
async function scanned(found: ScanResult[] = [], blocked = 0) {
	scanFinds(found, blocked);
	render(ScanModal, { onclose: vi.fn() });
	await fireEvent.input(target(), { target: { value: '192.168.1.0/24' } });
	await fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
	await screen.findByText('254 hosts scanned on 192.168.1.0/24');
}

beforeEach(() => {
	vi.resetAllMocks();
	(appState as { instances: OdioInstance[] }).instances = [];
	vi.mocked(findActiveNetworks).mockResolvedValue([]);
	scanFinds();
});

// ── dialog ────────────────────────────────────────────────────────────────────

describe('ScanModal — dialog', () => {
	test('opens on the form', () => {
		render(ScanModal, { onclose: vi.fn() });
		expect(screen.getByRole('dialog', { name: 'Scan network' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Scan' })).toBeInTheDocument();
	});

	test('Cancel, Close, Escape and the backdrop all close', async () => {
		const onclose = vi.fn();
		render(ScanModal, { onclose });
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		await fireEvent.click(document.querySelector('.scan-backdrop')!);
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(onclose).toHaveBeenCalledTimes(4);
	});

	test('closing aborts the scan', async () => {
		vi.mocked(scanHosts).mockReturnValue(new Promise(() => {}));
		render(ScanModal, { onclose: vi.fn() });
		await fireEvent.input(target(), { target: { value: '192.168.1.0/24' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(vi.mocked(scanHosts).mock.calls[0][2].signal.aborted).toBe(true);
	});
});

// ── scanning ──────────────────────────────────────────────────────────────────

describe('ScanModal — scanning', () => {
	test('an invalid target stays on the form with the error', async () => {
		render(ScanModal, { onclose: vi.fn() });
		await fireEvent.input(target(), { target: { value: '10.0.0.0/16' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
		expect(screen.getByText('Network too large (max /22)')).toBeInTheDocument();
		expect(scanHosts).not.toHaveBeenCalled();
	});

	test('with no target, scans the network of the instances in the list', async () => {
		(appState as { instances: OdioInstance[] }).instances = [kitchen];
		vi.mocked(scanHosts).mockReturnValue(new Promise(() => {}));
		render(ScanModal, { onclose: vi.fn() });
		await fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
		expect(screen.getByText('Network of kitchen')).toBeInTheDocument();
		expect(screen.getByText('Scanning 192.168.1.0/24…')).toBeInTheDocument();
		expect(screen.getByText('0 / 254')).toBeInTheDocument();
	});

	test('"Stop" keeps what was found', async () => {
		vi.mocked(scanHosts).mockImplementation((_hosts, _port, { onFound, onProgress }) => {
			onFound(salon);
			onProgress(112);
			return new Promise(() => {});
		});
		render(ScanModal, { onclose: vi.fn() });
		await fireEvent.input(target(), { target: { value: '192.168.1.0/24' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
		expect(screen.getByText('1 instance found')).toBeInTheDocument();
		expect(screen.getByText('112 hosts scanned on 192.168.1.0/24')).toBeInTheDocument();
		expect(screen.getByText('raspi-salon')).toBeInTheDocument();
	});
});

// ── outcome ───────────────────────────────────────────────────────────────────

describe('ScanModal — outcome', () => {
	test('sums up what was found, without the search steps', async () => {
		await scanned([salon, bureau]);
		expect(screen.getByText('2 instances found')).toBeInTheDocument();
		expect(screen.getByText('raspi-salon')).toBeInTheDocument();
		expect(screen.getByText('bureau')).toBeInTheDocument();
		expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
	});

	test('"Add all" adds every instance not in the list yet', async () => {
		vi.mocked(appState.findByHostPort).mockImplementation((host) =>
			host === '192.168.1.57' ? kitchen : undefined,
		);
		await scanned([salon, { host: '192.168.1.57', info: info('kitchen') }, bureau]);
		await fireEvent.click(screen.getByRole('button', { name: 'Add all (2)' }));
		expect(vi.mocked(appState.addInstance).mock.calls).toEqual([
			['192.168.1.23', 8018],
			['192.168.1.142', 8018],
		]);
	});

	test('"Add all" is not offered for a single instance', async () => {
		await scanned([salon]);
		expect(screen.queryByRole('button', { name: /Add all/ })).not.toBeInTheDocument();
	});

	test('"Scan again" goes back to the form, keeping the target', async () => {
		await scanned([salon]);
		await fireEvent.click(screen.getByRole('button', { name: 'Scan again' }));
		expect(target()).toHaveValue('192.168.1.0/24');
		expect(target()).toHaveFocus();
	});

	test('nothing answering suggests checking odio-api and its port, not CORS', async () => {
		await scanned();
		expect(screen.getByText('No odio-api found')).toBeInTheDocument();
		expect(screen.getByText('Check that odio-api is running and listens on port 8018.')).toBeInTheDocument();
		expect(screen.queryByText('api.cors.origins')).not.toBeInTheDocument();
	});

	test('hosts refusing this origin are the headline when nothing else is found', async () => {
		await scanned([], 6);
		expect(screen.getByText('6 hosts answer, but not to this site')).toBeInTheDocument();
		expect(screen.getByText(/^They listen on port 8018/)).toBeInTheDocument();
		expect(screen.getByText(location.origin)).toBeInTheDocument();
		expect(screen.queryByText(/Check that odio-api is running/)).not.toBeInTheDocument();
	});

	test('a single host refusing this origin is in the singular', async () => {
		await scanned([], 1);
		expect(screen.getByText('1 host answers, but not to this site')).toBeInTheDocument();
	});

	test('hosts refusing this origin come after the instances found', async () => {
		await scanned([salon, bureau], 4);
		expect(screen.getByText('2 instances found')).toBeInTheDocument();
		expect(screen.getByText(/^4 other hosts answer on port 8018/)).toBeInTheDocument();
		expect(screen.getByText(location.origin)).toBeInTheDocument();
	});

	test('hosts refusing this origin are not shown while still scanning', async () => {
		vi.mocked(scanHosts).mockImplementation((_hosts, _port, { onBlocked }) => {
			onBlocked?.('192.168.1.200');
			return new Promise(() => {});
		});
		render(ScanModal, { onclose: vi.fn() });
		await fireEvent.input(target(), { target: { value: '192.168.1.0/24' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
		expect(screen.queryByText('api.cors.origins')).not.toBeInTheDocument();
	});

	test('no active network shows the search steps and offers to enter one', async () => {
		render(ScanModal, { onclose: vi.fn() });
		await fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
		expect(await screen.findByText('No active network found')).toBeInTheDocument();
		expect(screen.getAllByText('none active')).toHaveLength(2);
		await fireEvent.click(screen.getByRole('button', { name: 'Enter a network' }));
		expect(target()).toHaveFocus();
	});
});
