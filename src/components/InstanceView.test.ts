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

vi.mock('../lib/state.svelte', () => ({
	appState: {
		get activeInstance() { return mockInstance; },
		get onlineInstances() { return [mockInstance, mockInstance2]; },
		connectOne: vi.fn((_id: string, extra?: { onPowerAction?: (a: PowerEvent) => void; onGiveUp?: () => void }) => {
			capturedCallbacks.onPowerAction = extra?.onPowerAction;
			capturedCallbacks.onGiveUp = extra?.onGiveUp;
		}),
		disconnectOne: vi.fn(),
		goToList: vi.fn(),
		openInstance: vi.fn(),
	},
}));

vi.mock('../lib/api', () => ({
	getInstanceUiUrl: (host: string, port: number) => `http://${host}:${port}/ui`,
}));

import InstanceView from './InstanceView.svelte';
import { appState } from '../lib/state.svelte';

beforeEach(() => {
	vi.clearAllMocks();
	mockInstance.status = 'online';
	capturedCallbacks.onPowerAction = undefined;
	capturedCallbacks.onGiveUp = undefined;
});

// ── normal state ──────────────────────────────────────────────────────────────

describe('InstanceView — normal state', () => {
	test('shows the iframe when no power event', () => {
		render(InstanceView);
		expect(document.querySelector('iframe')).toBeInTheDocument();
		expect(screen.queryByText('Server is rebooting')).not.toBeInTheDocument();
	});

	test('connects SSE with power callbacks on mount', () => {
		render(InstanceView);
		expect(appState.connectOne).toHaveBeenCalledWith('1', {
			onPowerAction: expect.any(Function),
			onGiveUp: expect.any(Function),
		});
	});

	test('disconnects SSE on unmount', () => {
		const { unmount } = render(InstanceView);
		unmount();
		expect(appState.disconnectOne).toHaveBeenCalledWith('1');
	});
});

// ── reboot ────────────────────────────────────────────────────────────────────

describe('InstanceView — reboot', () => {
	test('shows the reboot screen when power.action reboot is received', () => {
		render(InstanceView);
		flushSync(() => capturedCallbacks.onPowerAction?.('reboot'));
		expect(screen.getByText('Server is rebooting')).toBeInTheDocument();
		expect(document.querySelector('iframe')).not.toBeInTheDocument();
	});

	test('does not auto-reconnect while server is still online (regression)', () => {
		// Bug: the old $effect triggered immediately because status was 'online'
		// when power.action arrived, before the server had a chance to go offline.
		mockInstance.status = 'online';
		render(InstanceView);
		flushSync(() => capturedCallbacks.onPowerAction?.('reboot'));
		// Reboot screen must stay visible — server hasn't gone offline yet
		expect(screen.getByText('Server is rebooting')).toBeInTheDocument();
	});
});

// ── poweroff ──────────────────────────────────────────────────────────────────

describe('InstanceView — poweroff', () => {
	test('shows the poweroff screen when power.action poweroff is received', () => {
		render(InstanceView);
		flushSync(() => capturedCallbacks.onPowerAction?.('poweroff'));
		expect(screen.getByText('Server is shutting down')).toBeInTheDocument();
		expect(document.querySelector('iframe')).not.toBeInTheDocument();
	});

	test('onGiveUp callback triggers the poweroff choice screen', () => {
		render(InstanceView);
		flushSync(() => capturedCallbacks.onGiveUp?.());
		expect(screen.getByText('Server is shutting down')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Wait' })).toBeInTheDocument();
	});

	test('dismiss button calls appState.goToList', async () => {
		render(InstanceView);
		flushSync(() => capturedCallbacks.onPowerAction?.('poweroff'));
		const powerScreen = document.querySelector('.power-screen')!;
		await fireEvent.click(within(powerScreen).getByRole('button', { name: /back to list/i }));
		expect(appState.goToList).toHaveBeenCalledOnce();
	});

	test('dismiss button calls history.back()', async () => {
		const back = vi.spyOn(history, 'back').mockImplementation(() => {});
		render(InstanceView);
		flushSync(() => capturedCallbacks.onPowerAction?.('poweroff'));
		const powerScreen = document.querySelector('.power-screen')!;
		await fireEvent.click(within(powerScreen).getByRole('button', { name: /back to list/i }));
		expect(back).toHaveBeenCalledOnce();
		back.mockRestore();
	});

	test('clicking Wait restarts the connection', async () => {
		render(InstanceView);
		flushSync(() => capturedCallbacks.onGiveUp?.());
		await fireEvent.click(screen.getByRole('button', { name: 'Wait' }));
		expect(appState.connectOne).toHaveBeenCalledTimes(2); // mount + restart
		expect(appState.connectOne).toHaveBeenLastCalledWith('1', {
			onPowerAction: expect.any(Function),
			onGiveUp: expect.any(Function),
		});
	});

	test('clicking Wait switches to waiting spinner', async () => {
		render(InstanceView);
		flushSync(() => capturedCallbacks.onPowerAction?.('poweroff'));
		await fireEvent.click(screen.getByRole('button', { name: 'Wait' }));
		expect(screen.getByText(/Waiting for comeback/)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Wait' })).not.toBeInTheDocument();
	});
});

// ── switchTo ──────────────────────────────────────────────────────────────────

describe('InstanceView — switchTo', () => {
	test('switches SSE connection and opens the selected instance', async () => {
		render(InstanceView);
		// Open the instance switcher dropdown
		await fireEvent.click(screen.getByTitle('Switch instance'));
		// Click the second instance (Pi2, not the current one)
		await fireEvent.click(screen.getByText('Pi2'));
		expect(appState.connectOne).toHaveBeenLastCalledWith('2', expect.objectContaining({
			onPowerAction: expect.any(Function),
			onGiveUp: expect.any(Function),
		}));
		expect(appState.openInstance).toHaveBeenCalledWith('2');
	});
});
