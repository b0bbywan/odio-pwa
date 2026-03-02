import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/svelte';
import type { OdioInstance } from '../lib/types';

// Mock appState before importing the component so the component picks up the mock.
vi.mock('../lib/state.svelte', () => ({
	appState: {
		goToList: vi.fn(),
		onlineInstances: [] as OdioInstance[],
	},
}));

import InstanceTopBar from './InstanceTopBar.svelte';
import { appState } from '../lib/state.svelte';

const inst = (id: string, label: string): OdioInstance => ({
	id,
	host: '192.168.1.1',
	port: 8080,
	label,
	status: 'online',
});

beforeEach(() => {
	vi.clearAllMocks();
	(appState as { onlineInstances: OdioInstance[] }).onlineInstances = [];
});

// ── display ───────────────────────────────────────────────────────────────────

describe('InstanceTopBar — display', () => {
	test('shows the displayName', () => {
		render(InstanceTopBar, { displayName: 'My Pi', currentId: '1', onswitchto: vi.fn() });
		expect(screen.getByText('My Pi')).toBeInTheDocument();
	});

	test('back button calls appState.goToList', async () => {
		render(InstanceTopBar, { displayName: 'My Pi', currentId: '1', onswitchto: vi.fn() });
		await fireEvent.click(screen.getByTitle('Back to list'));
		expect(appState.goToList).toHaveBeenCalledOnce();
	});
});

// ── switcher hidden ───────────────────────────────────────────────────────────

describe('InstanceTopBar — switcher hidden', () => {
	test('no switcher button when there is only one online instance', () => {
		(appState as { onlineInstances: OdioInstance[] }).onlineInstances = [inst('1', 'Pi 1')];
		render(InstanceTopBar, { displayName: 'Pi 1', currentId: '1', onswitchto: vi.fn() });
		expect(screen.queryByTitle('Switch instance')).not.toBeInTheDocument();
	});
});

// ── switcher visible ──────────────────────────────────────────────────────────

describe('InstanceTopBar — switcher with multiple instances', () => {
	beforeEach(() => {
		(appState as { onlineInstances: OdioInstance[] }).onlineInstances = [
			inst('1', 'Pi 1'),
			inst('2', 'Pi 2'),
		];
	});

	test('switcher button is shown', () => {
		render(InstanceTopBar, { displayName: 'Pi 1', currentId: '1', onswitchto: vi.fn() });
		expect(screen.getByTitle('Switch instance')).toBeInTheDocument();
	});

	test('dropdown is hidden initially', () => {
		render(InstanceTopBar, { displayName: 'Pi 1', currentId: '1', onswitchto: vi.fn() });
		expect(screen.queryByText('Pi 2')).not.toBeInTheDocument();
	});

	test('clicking the switcher opens the dropdown', async () => {
		render(InstanceTopBar, { displayName: 'Pi 1', currentId: '1', onswitchto: vi.fn() });
		await fireEvent.click(screen.getByTitle('Switch instance'));
		expect(screen.getByText('Pi 2')).toBeInTheDocument();
	});

	test('current instance is excluded from the dropdown', async () => {
		render(InstanceTopBar, { displayName: 'Pi 1', currentId: '1', onswitchto: vi.fn() });
		await fireEvent.click(screen.getByTitle('Switch instance'));
		// Pi 2 is shown, but Pi 1 appears only in the top bar — not as a dropdown button
		const dropdownButtons = screen.getAllByRole('button');
		const dropdownItems = dropdownButtons.filter((b) => b.textContent?.includes('Pi 1') && b !== screen.getByTitle('Switch instance'));
		expect(dropdownItems).toHaveLength(0);
	});

	test('clicking a dropdown item calls onswitchto with the correct id', async () => {
		const onswitchto = vi.fn();
		render(InstanceTopBar, { displayName: 'Pi 1', currentId: '1', onswitchto });
		await fireEvent.click(screen.getByTitle('Switch instance'));
		await fireEvent.click(screen.getByText('Pi 2'));
		expect(onswitchto).toHaveBeenCalledWith('2');
	});

	test('clicking a dropdown item closes the dropdown', async () => {
		render(InstanceTopBar, { displayName: 'Pi 1', currentId: '1', onswitchto: vi.fn() });
		await fireEvent.click(screen.getByTitle('Switch instance'));
		await fireEvent.click(screen.getByText('Pi 2'));
		expect(screen.queryByText('Pi 2')).not.toBeInTheDocument();
	});

	test('clicking the backdrop closes the dropdown', async () => {
		render(InstanceTopBar, { displayName: 'Pi 1', currentId: '1', onswitchto: vi.fn() });
		await fireEvent.click(screen.getByTitle('Switch instance'));
		expect(screen.getByText('Pi 2')).toBeInTheDocument();
		// The backdrop is the element behind the dropdown; click it to dismiss
		const backdrop = document.querySelector('.switcher-backdrop') as HTMLElement;
		await fireEvent.click(backdrop);
		expect(screen.queryByText('Pi 2')).not.toBeInTheDocument();
	});
});
