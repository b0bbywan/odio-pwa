import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import type { PowerEvent, OdioInstance } from '../lib/types';

// vi.hoisted makes these available inside vi.mock factories, which are hoisted to the top.
// Reactive so a test can change the status after render, like the connection layer does.
const { mockInstance, mockInstance2 } = await vi.hoisted(async () => {
	const { reactive } = await import('../test/reactive.svelte');
	return {
		mockInstance: reactive<OdioInstance>({
			id: '1',
			host: '192.168.1.1',
			port: 8080,
			label: 'Pi',
			status: 'online',
		}),
		mockInstance2: reactive<OdioInstance>({
			id: '2',
			host: '192.168.1.2',
			port: 8080,
			label: 'Pi2',
			status: 'online',
		}),
	};
});

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

vi.mock('svelte-spa-router', () => ({ push: vi.fn(), replace: vi.fn(), router: mockRouter }));

vi.mock('../lib/nav', () => ({ goHome: vi.fn(), showInFrame: vi.fn() }));

vi.mock('../lib/api', () => ({
	getInstanceUiUrl: (host: string, port: number) => `http://${host}:${port}/ui`,
}));

import InstanceView from './InstanceView.svelte';
import { appState } from '../lib/state.svelte';
import { push, replace } from 'svelte-spa-router';
import { goHome, showInFrame } from '../lib/nav';

const params = (host: string, port?: string) => ({ params: { host, port: port ?? null } });
const defaultParams = params('192.168.1.1', '8080');

beforeEach(() => {
	vi.clearAllMocks();
	mockInstance.status = 'online';
	mockInstance2.status = 'online';
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
		expect(replace).toHaveBeenCalledWith('/');
		expect(appState.addInstance).not.toHaveBeenCalled();
	});

	test('redirects to / when the port is out of range', () => {
		render(InstanceView, params('10.0.0.99', '99999'));
		expect(replace).toHaveBeenCalledWith('/');
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

	test('dismiss button goes home', async () => {
		render(InstanceView, defaultParams);
		flushSync(() => capturedCallbacks.onPowerAction?.('poweroff'));
		const powerScreen = document.querySelector<HTMLElement>('.status-screen')!;
		await fireEvent.click(within(powerScreen).getByRole('button', { name: /back to list/i }));
		expect(goHome).toHaveBeenCalledOnce();
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

	test('a cors server that goes down shows the offline screen, not a kept iframe', () => {
		mockInstance.status = 'cors';
		render(InstanceView, defaultParams);
		// Never online, so the connection reports offline, not reconnecting.
		flushSync(() => { mockInstance.status = 'offline'; });
		flushSync(() => capturedCallbacks.onGiveUp?.());
		expect(screen.getByText('Server unreachable')).toBeInTheDocument();
		expect(screen.queryByText('Reconnecting')).not.toBeInTheDocument();
		expect(document.querySelector('iframe')).not.toBeInTheDocument();
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

	test('back button on the Connecting screen goes home', async () => {
		mockInstance.status = 'probing';
		mockInstance.transient = false;
		render(InstanceView, defaultParams);
		const screenEl = document.querySelector<HTMLElement>('.status-screen')!;
		await fireEvent.click(within(screenEl).getByRole('button', { name: /back to list/i }));
		expect(goHome).toHaveBeenCalledOnce();
	});

	test('back button on the offline screen goes home for a saved instance', async () => {
		mockInstance.status = 'offline';
		mockInstance.transient = false;
		render(InstanceView, defaultParams);
		const screenEl = document.querySelector<HTMLElement>('.status-screen')!;
		await fireEvent.click(within(screenEl).getByRole('button', { name: /back to list/i }));
		expect(goHome).toHaveBeenCalledOnce();
	});

	test('back button on the offline screen goes home even for a transient instance', async () => {
		mockInstance.status = 'offline';
		mockInstance.transient = true;
		render(InstanceView, defaultParams);
		const screenEl = document.querySelector<HTMLElement>('.status-screen')!;
		await fireEvent.click(within(screenEl).getByRole('button', { name: /back to list/i }));
		expect(goHome).toHaveBeenCalledOnce();
		expect(mockState.savePromptVisible).toBe(false);
	});
});

// ── reconnecting ──────────────────────────────────────────────────────────────

describe('InstanceView — reconnecting', () => {
	test('keeps the same iframe when the connection drops after the UI was shown', () => {
		render(InstanceView, defaultParams);
		const before = document.querySelector('iframe');
		flushSync(() => { mockInstance.status = 'reconnecting'; });
		expect(document.querySelector('iframe')).toBe(before);
		expect(screen.queryByText(/Connecting to/)).not.toBeInTheDocument();
	});

	test('does not rebuild the iframe when the connection comes back', () => {
		render(InstanceView, defaultParams);
		const before = document.querySelector('iframe');
		flushSync(() => { mockInstance.status = 'reconnecting'; });
		flushSync(() => { mockInstance.status = 'online'; });
		expect(document.querySelector('iframe')).toBe(before);
	});

	test('opened while already reconnecting: waits on the status screen, no dead iframe', () => {
		mockInstance.status = 'reconnecting';
		render(InstanceView, defaultParams);
		expect(screen.getByText(/Connecting to/)).toBeInTheDocument();
		expect(document.querySelector('iframe')).not.toBeInTheDocument();
		expect(screen.queryByText('Reconnecting')).not.toBeInTheDocument();
		flushSync(() => { mockInstance.status = 'online'; });
		expect(document.querySelector('iframe')).toBeInTheDocument();
	});

	test('shows the reconnecting pill and veil while the connection is down', () => {
		render(InstanceView, defaultParams);
		expect(screen.queryByText('Reconnecting')).not.toBeInTheDocument();
		expect(document.querySelector('.instance-veil')).not.toBeInTheDocument();
		flushSync(() => { mockInstance.status = 'reconnecting'; });
		expect(screen.getByText('Reconnecting')).toBeInTheDocument();
		expect(document.querySelector('.instance-veil')).toBeInTheDocument();
		flushSync(() => { mockInstance.status = 'online'; });
		expect(screen.queryByText('Reconnecting')).not.toBeInTheDocument();
		expect(document.querySelector('.instance-veil')).not.toBeInTheDocument();
	});

	test('no reconnecting pill on the status screen of a host never reached', () => {
		mockInstance.status = 'offline';
		render(InstanceView, defaultParams);
		expect(screen.queryByText('Reconnecting')).not.toBeInTheDocument();
	});

	test('hides the node dashboard button while reconnecting', () => {
		render(InstanceView, defaultParams);
		flushSync(() => { mockInstance.status = 'reconnecting'; });
		expect(screen.queryByTitle('Node dashboard')).not.toBeInTheDocument();
		flushSync(() => { mockInstance.status = 'online'; });
		expect(screen.getByTitle('Node dashboard')).toBeInTheDocument();
	});

	test('a power event still replaces the kept iframe', () => {
		render(InstanceView, defaultParams);
		flushSync(() => { mockInstance.status = 'reconnecting'; });
		flushSync(() => capturedCallbacks.onPowerAction?.('reboot'));
		expect(screen.getByText('Server is rebooting')).toBeInTheDocument();
		expect(document.querySelector('iframe')).not.toBeInTheDocument();
	});

	test('giving up while reconnecting shows the poweroff choice screen', () => {
		mockInstance.connectedAt = Date.now();
		render(InstanceView, defaultParams);
		flushSync(() => { mockInstance.status = 'reconnecting'; });
		// The connection reports offline and gives up in the same task.
		flushSync(() => {
			mockInstance.status = 'offline';
			capturedCallbacks.onGiveUp?.();
		});
		expect(screen.getByText('Server is shutting down')).toBeInTheDocument();
		expect(document.querySelector('iframe')).not.toBeInTheDocument();
	});

	test('switching to an offline instance shows its status screen, not the kept iframe', async () => {
		mockInstance2.status = 'offline';
		const { rerender } = render(InstanceView, defaultParams);
		await rerender(params('192.168.1.2', '8080'));
		expect(screen.getByText('Server unreachable')).toBeInTheDocument();
		expect(document.querySelector('iframe')).not.toBeInTheDocument();
	});

	test('switching to a reconnecting instance never mounts its iframe', async () => {
		mockInstance2.status = 'reconnecting';
		const { rerender } = render(InstanceView, defaultParams);
		const mounted: string[] = [];
		const observer = new MutationObserver((records) => {
			for (const r of records) {
				for (const n of r.addedNodes) {
					if (n instanceof HTMLIFrameElement) mounted.push(n.src);
				}
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
		await rerender(params('192.168.1.2', '8080'));
		await Promise.resolve(); // deliver the mutation records
		observer.disconnect();
		expect(mounted).not.toContain('http://192.168.1.2:8080/ui');
		expect(screen.getByText(/Connecting to/)).toBeInTheDocument();
	});

	test('leaving a transient instance while reconnecting still asks to save it', async () => {
		mockInstance.transient = true;
		render(InstanceView, defaultParams);
		flushSync(() => { mockInstance.status = 'reconnecting'; });
		await fireEvent.click(screen.getByTitle('Back to list'));
		expect(mockState.savePromptVisible).toBe(true);
		expect(goHome).not.toHaveBeenCalled();
	});
});

// ── node dashboard ────────────────────────────────────────────────────────────

describe('InstanceView — node dashboard', () => {
	test('brings the iframe back to the instance UI', async () => {
		render(InstanceView, defaultParams);
		await fireEvent.click(screen.getByTitle('Node dashboard'));
		expect(showInFrame).toHaveBeenCalledWith(document.querySelector('iframe'), 'http://192.168.1.1:8080/ui');
	});

	test('hidden while the iframe is not shown', () => {
		mockInstance.status = 'offline';
		render(InstanceView, defaultParams);
		expect(screen.queryByTitle('Node dashboard')).not.toBeInTheDocument();
	});

	test('hidden on the power screen', () => {
		render(InstanceView, defaultParams);
		flushSync(() => capturedCallbacks.onPowerAction?.('poweroff'));
		expect(screen.queryByTitle('Node dashboard')).not.toBeInTheDocument();
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

	test('a new instance gets a new iframe, not a new src on the old one', async () => {
		const { rerender } = render(InstanceView, defaultParams);
		const first = document.querySelector('iframe');
		await rerender(params('192.168.1.2', '8080'));
		const second = document.querySelector('iframe');
		expect(second).toHaveAttribute('src', 'http://192.168.1.2:8080/ui');
		expect(second).not.toBe(first);
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

	test('home button on a non-transient instance goes home', async () => {
		mockInstance.transient = false;
		render(InstanceView, defaultParams);
		await fireEvent.click(screen.getByTitle('Back to list'));
		expect(goHome).toHaveBeenCalledOnce();
		expect(mockState.savePromptVisible).toBe(false);
	});

	test('home button on a transient online instance shows the save prompt', async () => {
		mockInstance.transient = true;
		mockInstance.status = 'online';
		render(InstanceView, defaultParams);
		await fireEvent.click(screen.getByTitle('Back to list'));
		expect(mockState.savePromptVisible).toBe(true);
		expect(goHome).not.toHaveBeenCalled();
	});

	test('home button on a transient offline instance just goes home (no point saving an unreachable host)', async () => {
		mockInstance.transient = true;
		mockInstance.status = 'offline';
		render(InstanceView, defaultParams);
		await fireEvent.click(screen.getByTitle('Back to list'));
		expect(goHome).toHaveBeenCalledOnce();
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

	test('home button behind the power screen still asks to save', async () => {
		mockInstance.transient = true;
		render(InstanceView, defaultParams);
		flushSync(() => capturedCallbacks.onPowerAction?.('reboot'));
		await fireEvent.click(screen.getByTitle('Back to list'));
		expect(mockState.savePromptVisible).toBe(true);
		expect(goHome).not.toHaveBeenCalled();
	});

	test('browser back behind the power screen still asks to save', () => {
		mockInstance.transient = true;
		render(InstanceView, defaultParams);
		flushSync(() => capturedCallbacks.onPowerAction?.('poweroff'));
		window.dispatchEvent(new PopStateEvent('popstate'));
		expect(mockState.savePromptVisible).toBe(true);
	});

	test('a reboot does not push another history entry', () => {
		mockInstance.transient = true;
		render(InstanceView, defaultParams);
		const length = history.length;
		flushSync(() => capturedCallbacks.onPowerAction?.('reboot'));
		flushSync(() => { mockInstance.status = 'reconnecting'; });
		flushSync(() => { mockInstance.status = 'online'; });
		expect(screen.getByTitle('odio-api UI - Pi')).toBeInTheDocument(); // reboot over
		expect(history.length).toBe(length);
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

	test('closing the dialog, as Escape does, hides the prompt without persisting or navigating', () => {
		mockInstance.transient = true;
		mockState.savePromptVisible = true;
		render(InstanceView, defaultParams);
		screen.getByRole<HTMLDialogElement>('dialog').close();
		expect(mockState.savePromptVisible).toBe(false);
		expect(push).not.toHaveBeenCalled();
		expect(appState.persistInstance).not.toHaveBeenCalled();
		expect(appState.removeInstance).not.toHaveBeenCalled();
	});
});
