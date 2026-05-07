import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import type { PowerEvent, OdioInstance } from '../lib/types';

// vi.hoisted makes these available inside vi.mock factories, which are hoisted to the top.
const mockInstance = vi.hoisted((): OdioInstance => ({
	id: '1',
	host: '192.168.1.1',
	port: 8080,
	label: 'Pi',
	status: 'online',
}));

const mockInstance2 = vi.hoisted((): OdioInstance => ({
	id: '2',
	host: '192.168.1.2',
	port: 8080,
	label: 'Pi2',
	status: 'online',
}));

const capturedCallbacks = vi.hoisted(() => ({
	onPowerAction: undefined as ((action: PowerEvent) => void) | undefined,
	onGiveUp: undefined as (() => void) | undefined,
}));

const mockState = vi.hoisted(() => ({ savePromptVisible: false }));

vi.mock('../lib/state.svelte', () => ({
	appState: {
		get connectableInstances() { return [mockInstance, mockInstance2]; },
		get savePromptVisible() { return mockState.savePromptVisible; },
		set savePromptVisible(v: boolean) { mockState.savePromptVisible = v; },
		findByHostPort: vi.fn((host: string, port: number) => {
			if (host === mockInstance.host && port === mockInstance.port) return mockInstance;
			if (host === mockInstance2.host && port === mockInstance2.port) return mockInstance2;
			return undefined;
		}),
		findById: vi.fn((id: string) => {
			if (id === mockInstance.id) return mockInstance;
			if (id === mockInstance2.id) return mockInstance2;
			return undefined;
		}),
		addInstance: vi.fn(),
		connectOne: vi.fn((_id: string, extra?: { onPowerAction?: (a: PowerEvent) => void; onGiveUp?: () => void }) => {
			capturedCallbacks.onPowerAction = extra?.onPowerAction;
			capturedCallbacks.onGiveUp = extra?.onGiveUp;
		}),
		disconnectOne: vi.fn(),
		openInstance: vi.fn(),
		persistInstance: vi.fn(),
		removeInstance: vi.fn(),
	},
}));

const mockRouter = vi.hoisted(() => ({ querystring: '' }));

vi.mock('svelte-spa-router', () => ({ push: vi.fn(), router: mockRouter }));

vi.mock('../lib/api', () => ({
	getInstanceUiUrl: (host: string, port: number) => `http://${host}:${port}/ui`,
}));

import InstanceView from './InstanceView.svelte';
import { appState } from '../lib/state.svelte';
import { push } from 'svelte-spa-router';

const params = (host: string, port?: string) => ({ params: { host, port: port ?? null } });
const defaultParams = params('192.168.1.1', '8080');

beforeEach(() => {
	vi.clearAllMocks();
	mockInstance.status = 'online';
	mockInstance.transient = undefined;
	mockInstance.connectedAt = undefined;
	capturedCallbacks.onPowerAction = undefined;
	capturedCallbacks.onGiveUp = undefined;
	mockState.savePromptVisible = false;
	mockRouter.querystring = '';
	history.replaceState(null, '', '/');
});

// ── normal state ──────────────────────────────────────────────────────────────

describe('InstanceView — normal state', () => {
	test('shows the iframe when no power event', () => {
		render(InstanceView, defaultParams);
		expect(document.querySelector('iframe')).toBeInTheDocument();
		expect(screen.queryByText('Server is rebooting')).not.toBeInTheDocument();
	});

	test('connects SSE with power callbacks on mount', () => {
		render(InstanceView, defaultParams);
		expect(appState.connectOne).toHaveBeenCalledWith('1', {
			onPowerAction: expect.any(Function),
			onGiveUp: expect.any(Function),
		});
	});

	test('hands the connection back to the background pool on unmount (no power callbacks)', () => {
		const { unmount } = render(InstanceView, defaultParams);
		vi.mocked(appState.connectOne).mockClear();
		unmount();
		// Reconnects without callbacks so the list view keeps live status.
		expect(appState.connectOne).toHaveBeenCalledWith('1');
		expect(appState.connectOne).toHaveBeenCalledTimes(1);
	});

	test('creates a transient instance when no match exists for the route params', () => {
		render(InstanceView, params('10.0.0.99', '9000'));
		expect(appState.addInstance).toHaveBeenCalledWith('10.0.0.99', 9000, undefined, { transient: true });
	});

	test('reads label from the router querystring on transient creation', () => {
		mockRouter.querystring = 'label=Salon';
		render(InstanceView, params('10.0.0.99', '9000'));
		expect(appState.addInstance).toHaveBeenCalledWith('10.0.0.99', 9000, 'Salon', { transient: true });
	});

	test('redirects to / when the port is not a valid number', () => {
		render(InstanceView, params('10.0.0.99', 'abc'));
		expect(push).toHaveBeenCalledWith('/');
		expect(appState.addInstance).not.toHaveBeenCalled();
	});

	test('redirects to / when the port is out of range', () => {
		render(InstanceView, params('10.0.0.99', '99999'));
		expect(push).toHaveBeenCalledWith('/');
		expect(appState.addInstance).not.toHaveBeenCalled();
	});

	test('removes the transient instance on unmount when not saved', () => {
		const txId = 'tx-1';
		const tx: OdioInstance = {
			id: txId, host: '10.0.0.99', port: 9000, status: 'unknown', transient: true,
		};
		vi.mocked(appState.addInstance).mockReturnValue(txId);
		vi.mocked(appState.findById).mockImplementation((id: string) => {
			if (id === txId) return tx;
			if (id === '1') return mockInstance;
			if (id === '2') return mockInstance2;
			return undefined;
		});
		const { unmount } = render(InstanceView, params('10.0.0.99', '9000'));
		expect(appState.addInstance).toHaveBeenCalledOnce();
		unmount();
		expect(appState.removeInstance).toHaveBeenCalledWith(txId);
	});

	test('does not remove an instance that has been saved before unmount', () => {
		const txId = 'tx-2';
		const saved: OdioInstance = {
			id: txId, host: '10.0.0.99', port: 9000, status: 'online', transient: false,
		};
		vi.mocked(appState.addInstance).mockReturnValue(txId);
		vi.mocked(appState.findById).mockImplementation((id: string) => {
			if (id === txId) return saved;
			if (id === '1') return mockInstance;
			if (id === '2') return mockInstance2;
			return undefined;
		});
		const { unmount } = render(InstanceView, params('10.0.0.99', '9000'));
		unmount();
		expect(appState.removeInstance).not.toHaveBeenCalled();
	});
});

// ── reboot ────────────────────────────────────────────────────────────────────

describe('InstanceView — reboot', () => {
	test('shows the reboot screen when power.action reboot is received', () => {
		render(InstanceView, defaultParams);
		flushSync(() => capturedCallbacks.onPowerAction?.('reboot'));
		expect(screen.getByText('Server is rebooting')).toBeInTheDocument();
		expect(document.querySelector('iframe')).not.toBeInTheDocument();
	});

	test('does not auto-reconnect while server is still online (regression)', () => {
		mockInstance.status = 'online';
		render(InstanceView, defaultParams);
		flushSync(() => capturedCallbacks.onPowerAction?.('reboot'));
		expect(screen.getByText('Server is rebooting')).toBeInTheDocument();
	});
});

// ── poweroff ──────────────────────────────────────────────────────────────────

describe('InstanceView — poweroff', () => {
	test('shows the poweroff screen when power.action poweroff is received', () => {
		render(InstanceView, defaultParams);
		flushSync(() => capturedCallbacks.onPowerAction?.('poweroff'));
		expect(screen.getByText('Server is shutting down')).toBeInTheDocument();
		expect(document.querySelector('iframe')).not.toBeInTheDocument();
	});

	test('onGiveUp callback triggers the poweroff choice screen for a previously-connected instance', () => {
		mockInstance.connectedAt = Date.now();
		render(InstanceView, defaultParams);
		flushSync(() => capturedCallbacks.onGiveUp?.());
		expect(screen.getByText('Server is shutting down')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Wait' })).toBeInTheDocument();
	});

	test('onGiveUp on a never-connected host stays on the offline screen, no fake "shutting down"', () => {
		mockInstance.connectedAt = undefined;
		mockInstance.status = 'offline';
		render(InstanceView, defaultParams);
		flushSync(() => capturedCallbacks.onGiveUp?.());
		expect(screen.queryByText('Server is shutting down')).not.toBeInTheDocument();
		expect(screen.getByText('Server unreachable')).toBeInTheDocument();
	});

	test('dismiss button routes to /', async () => {
		render(InstanceView, defaultParams);
		flushSync(() => capturedCallbacks.onPowerAction?.('poweroff'));
		const powerScreen = document.querySelector<HTMLElement>('.status-screen')!;
		await fireEvent.click(within(powerScreen).getByRole('button', { name: /back to list/i }));
		expect(push).toHaveBeenCalledWith('/');
	});

	test('clicking Wait restarts the connection', async () => {
		mockInstance.connectedAt = Date.now();
		render(InstanceView, defaultParams);
		flushSync(() => capturedCallbacks.onGiveUp?.());
		await fireEvent.click(screen.getByRole('button', { name: 'Wait' }));
		expect(appState.connectOne).toHaveBeenCalledTimes(2); // mount + restart
		expect(appState.connectOne).toHaveBeenLastCalledWith('1', {
			onPowerAction: expect.any(Function),
			onGiveUp: expect.any(Function),
		});
	});

	test('clicking Wait switches to waiting spinner', async () => {
		render(InstanceView, defaultParams);
		flushSync(() => capturedCallbacks.onPowerAction?.('poweroff'));
		await fireEvent.click(screen.getByRole('button', { name: 'Wait' }));
		expect(screen.getByText(/Waiting for comeback/)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Wait' })).not.toBeInTheDocument();
	});
});

// ── cors ──────────────────────────────────────────────────────────────────────

describe('InstanceView — cors', () => {
	test('connects with callbacks even when status is cors (probe layer skips retries on its own)', () => {
		mockInstance.status = 'cors';
		render(InstanceView, defaultParams);
		expect(appState.connectOne).toHaveBeenCalledWith('1', {
			onPowerAction: expect.any(Function),
			onGiveUp: expect.any(Function),
		});
	});

	test('renders the iframe when status is cors', () => {
		mockInstance.status = 'cors';
		render(InstanceView, defaultParams);
		expect(document.querySelector('iframe')).toBeInTheDocument();
	});
});

// ── connection status screen ──────────────────────────────────────────────────

describe('InstanceView — connection status screen', () => {
	test('shows "Connecting" when status is probing, no iframe', () => {
		mockInstance.status = 'probing';
		render(InstanceView, defaultParams);
		expect(screen.getByText(/Connecting to/)).toBeInTheDocument();
		expect(document.querySelector('iframe')).not.toBeInTheDocument();
	});

	test('shows "Connecting" when status is unknown, no iframe', () => {
		mockInstance.status = 'unknown';
		render(InstanceView, defaultParams);
		expect(screen.getByText(/Connecting to/)).toBeInTheDocument();
		expect(document.querySelector('iframe')).not.toBeInTheDocument();
	});

	test('shows "Server unreachable" when status is offline, no iframe', () => {
		mockInstance.status = 'offline';
		render(InstanceView, defaultParams);
		expect(screen.getByText('Server unreachable')).toBeInTheDocument();
		expect(document.querySelector('iframe')).not.toBeInTheDocument();
	});

	test('shows "Browser blocked" when status is blocked, no iframe', () => {
		mockInstance.status = 'blocked';
		render(InstanceView, defaultParams);
		expect(screen.getByText(/Browser blocked/)).toBeInTheDocument();
		expect(document.querySelector('iframe')).not.toBeInTheDocument();
	});

	test('back button on the Connecting screen routes to /', async () => {
		mockInstance.status = 'probing';
		mockInstance.transient = false;
		render(InstanceView, defaultParams);
		const screenEl = document.querySelector<HTMLElement>('.status-screen')!;
		await fireEvent.click(within(screenEl).getByRole('button', { name: /back to list/i }));
		expect(push).toHaveBeenCalledWith('/');
	});

	test('back button on the offline screen routes to / for a saved instance', async () => {
		mockInstance.status = 'offline';
		mockInstance.transient = false;
		render(InstanceView, defaultParams);
		const screenEl = document.querySelector<HTMLElement>('.status-screen')!;
		await fireEvent.click(within(screenEl).getByRole('button', { name: /back to list/i }));
		expect(push).toHaveBeenCalledWith('/');
	});

	test('back button on the offline screen routes to / even for a transient instance', async () => {
		mockInstance.status = 'offline';
		mockInstance.transient = true;
		render(InstanceView, defaultParams);
		const screenEl = document.querySelector<HTMLElement>('.status-screen')!;
		await fireEvent.click(within(screenEl).getByRole('button', { name: /back to list/i }));
		expect(push).toHaveBeenCalledWith('/');
		expect(mockState.savePromptVisible).toBe(false);
	});
});

// ── switchTo ──────────────────────────────────────────────────────────────────

describe('InstanceView — switchTo', () => {
	test('switching opens the selected instance via the router', async () => {
		render(InstanceView, defaultParams);
		await fireEvent.click(screen.getByTitle('Switch instance'));
		await fireEvent.click(screen.getByText('Pi2'));
		expect(appState.openInstance).toHaveBeenCalledWith('2');
	});
});

// ── transient instance ────────────────────────────────────────────────────────

describe('InstanceView — transient', () => {
	test('Save button in the top bar is hidden for non-transient instances', () => {
		mockInstance.transient = false;
		render(InstanceView, defaultParams);
		expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
	});

	test('Save button in the top bar is shown for transient instances', () => {
		mockInstance.transient = true;
		render(InstanceView, defaultParams);
		expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
	});

	test('clicking the Save button calls persistInstance with the instance id', async () => {
		mockInstance.transient = true;
		render(InstanceView, defaultParams);
		await fireEvent.click(screen.getByRole('button', { name: /save/i }));
		expect(appState.persistInstance).toHaveBeenCalledWith('1');
	});

	test('back button on a non-transient instance routes to /', async () => {
		mockInstance.transient = false;
		render(InstanceView, defaultParams);
		await fireEvent.click(screen.getByTitle('Back to list'));
		expect(push).toHaveBeenCalledWith('/');
		expect(mockState.savePromptVisible).toBe(false);
	});

	test('back button on a transient online instance shows the save prompt', async () => {
		mockInstance.transient = true;
		mockInstance.status = 'online';
		render(InstanceView, defaultParams);
		await fireEvent.click(screen.getByTitle('Back to list'));
		expect(mockState.savePromptVisible).toBe(true);
		expect(push).not.toHaveBeenCalled();
	});

	test('back button on a transient offline instance just routes to / (no point saving an unreachable host)', async () => {
		mockInstance.transient = true;
		mockInstance.status = 'offline';
		render(InstanceView, defaultParams);
		await fireEvent.click(screen.getByTitle('Back to list'));
		expect(push).toHaveBeenCalledWith('/');
		expect(mockState.savePromptVisible).toBe(false);
	});

	test('browser back (popstate) on a transient online instance shows the save prompt', () => {
		mockInstance.transient = true;
		mockInstance.status = 'online';
		render(InstanceView, defaultParams);
		expect(mockState.savePromptVisible).toBe(false);
		window.dispatchEvent(new PopStateEvent('popstate'));
		expect(mockState.savePromptVisible).toBe(true);
	});

	test('browser back is not trapped on a non-transient instance', () => {
		mockInstance.transient = false;
		render(InstanceView, defaultParams);
		window.dispatchEvent(new PopStateEvent('popstate'));
		expect(mockState.savePromptVisible).toBe(false);
	});

	test('browser back is not trapped on a transient offline instance (probe is futile)', () => {
		mockInstance.transient = true;
		mockInstance.status = 'offline';
		render(InstanceView, defaultParams);
		window.dispatchEvent(new PopStateEvent('popstate'));
		expect(mockState.savePromptVisible).toBe(false);
	});
});

// ── save prompt ───────────────────────────────────────────────────────────────

describe('InstanceView — save prompt', () => {
	test('does not render when savePromptVisible is false', () => {
		mockInstance.transient = true;
		mockState.savePromptVisible = false;
		render(InstanceView, defaultParams);
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	test('does not render when the instance is not transient (defensive)', () => {
		mockInstance.transient = false;
		mockState.savePromptVisible = true;
		render(InstanceView, defaultParams);
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	test('renders when both flags are set', () => {
		mockInstance.transient = true;
		mockState.savePromptVisible = true;
		render(InstanceView, defaultParams);
		expect(screen.getByRole('dialog', { name: /save this instance/i })).toBeInTheDocument();
	});

	test('Save action persists the instance and routes to /', async () => {
		mockInstance.transient = true;
		mockState.savePromptVisible = true;
		render(InstanceView, defaultParams);
		const dialog = screen.getByRole('dialog');
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
		expect(appState.persistInstance).toHaveBeenCalledWith('1');
		expect(mockState.savePromptVisible).toBe(false);
		expect(push).toHaveBeenCalledWith('/');
	});

	test("Don't save action removes the transient instance and routes to /", async () => {
		mockInstance.transient = true;
		mockState.savePromptVisible = true;
		render(InstanceView, defaultParams);
		const dialog = screen.getByRole('dialog');
		await fireEvent.click(within(dialog).getByRole('button', { name: /don't save/i }));
		expect(appState.removeInstance).toHaveBeenCalledWith('1');
		expect(mockState.savePromptVisible).toBe(false);
		expect(push).toHaveBeenCalledWith('/');
		expect(appState.persistInstance).not.toHaveBeenCalled();
	});

	test('Cancel action only hides the prompt — no navigation or persistence', async () => {
		mockInstance.transient = true;
		mockState.savePromptVisible = true;
		render(InstanceView, defaultParams);
		const dialog = screen.getByRole('dialog');
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
		expect(mockState.savePromptVisible).toBe(false);
		expect(push).not.toHaveBeenCalled();
		expect(appState.persistInstance).not.toHaveBeenCalled();
		expect(appState.removeInstance).not.toHaveBeenCalled();
	});

	test('Escape key closes the prompt without persisting or navigating', () => {
		mockInstance.transient = true;
		mockState.savePromptVisible = true;
		render(InstanceView, defaultParams);
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(mockState.savePromptVisible).toBe(false);
		expect(push).not.toHaveBeenCalled();
		expect(appState.persistInstance).not.toHaveBeenCalled();
		expect(appState.removeInstance).not.toHaveBeenCalled();
	});

	test('Escape key is a no-op when the prompt is closed', () => {
		mockInstance.transient = true;
		mockState.savePromptVisible = false;
		render(InstanceView, defaultParams);
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(mockState.savePromptVisible).toBe(false);
	});
});
