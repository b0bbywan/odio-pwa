import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import type { OdioInstance } from '../lib/types';

// InstanceList renders InstanceCard children which render AddInstanceForm inline,
// so the mock must cover all methods those components need too.
vi.mock('../lib/state.svelte', () => ({
	appState: {
		connectAll: vi.fn(),
		disconnectAll: vi.fn(),
		probeAll: vi.fn(),
		probeOne: vi.fn(),
		openInstance: vi.fn(),
		removeInstance: vi.fn(),
		addInstance: vi.fn(),
		updateInstance: vi.fn(),
		instances: [] as OdioInstance[],
		sortedInstances: [] as OdioInstance[],
	},
}));

import InstanceList from './InstanceList.svelte';
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
	(appState as { instances: OdioInstance[]; sortedInstances: OdioInstance[] }).instances = [];
	(appState as { instances: OdioInstance[]; sortedInstances: OdioInstance[] }).sortedInstances = [];
});

// ── empty state ───────────────────────────────────────────────────────────────

describe('InstanceList — empty state', () => {
	test('shows empty state message when there are no instances', () => {
		render(InstanceList);
		expect(screen.getByText(/No instances configured/)).toBeInTheDocument();
	});

	test('hides empty state when instances exist', () => {
		(appState as { instances: OdioInstance[] }).instances = [inst('1', 'Pi')];
		(appState as { sortedInstances: OdioInstance[] }).sortedInstances = [inst('1', 'Pi')];
		render(InstanceList);
		expect(screen.queryByText(/No instances configured/)).not.toBeInTheDocument();
	});
});

// Lifecycle (connectAll/disconnectAll) lives in App.svelte now so probes keep
// running when the user is on the instance route directly (e.g. after F5).

// ── toolbar ───────────────────────────────────────────────────────────────────

describe('InstanceList — toolbar', () => {
	test('"Refresh all" button calls probeAll', async () => {
		render(InstanceList);
		await fireEvent.click(screen.getByTitle('Refresh all'));
		expect(appState.probeAll).toHaveBeenCalledOnce();
	});
});

// ── staggered columns ─────────────────────────────────────────────────────────

describe('InstanceList — staggered columns', () => {
	test('deals cards alternately and keeps the list order through `order`', () => {
		(appState as { instances: OdioInstance[] }).instances = [
			inst('1', 'Local'),
			inst('2', 'raspodio'),
			inst('3', 'htpc'),
		];
		const { container } = render(InstanceList);
		const columns = [...container.querySelectorAll('.card-column')].map((col) =>
			[...col.querySelectorAll('.card-slot')].map((slot) => [
				slot.querySelector('h3')!.textContent,
				(slot as HTMLElement).style.order,
			]),
		);
		expect(columns).toEqual([
			[
				['Local', '0'],
				['htpc', '2'],
			],
			[['raspodio', '1']],
		]);
	});
});

// ── instance cards ────────────────────────────────────────────────────────────

describe('InstanceList — instance cards', () => {
	test('renders a card for each instance in sortedInstances', () => {
		(appState as { instances: OdioInstance[] }).instances = [inst('1', 'Pi 1'), inst('2', 'Pi 2')];
		(appState as { sortedInstances: OdioInstance[] }).sortedInstances = [inst('1', 'Pi 1'), inst('2', 'Pi 2')];
		render(InstanceList);
		expect(screen.getByText('Pi 1')).toBeInTheDocument();
		expect(screen.getByText('Pi 2')).toBeInTheDocument();
	});
});

// ── add instance form ─────────────────────────────────────────────────────────

describe('InstanceList — add instance form', () => {
	test('"+ Add Instance" button is shown by default', () => {
		render(InstanceList);
		expect(screen.getByRole('button', { name: '+ Add Instance' })).toBeInTheDocument();
	});

	test('clicking the button shows the form and hides the button', async () => {
		render(InstanceList);
		await fireEvent.click(screen.getByRole('button', { name: '+ Add Instance' }));
		expect(screen.getByRole('heading', { name: 'Add Instance' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: '+ Add Instance' })).not.toBeInTheDocument();
	});

	test('cancelling the form brings the button back', async () => {
		render(InstanceList);
		await fireEvent.click(screen.getByRole('button', { name: '+ Add Instance' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.getByRole('button', { name: '+ Add Instance' })).toBeInTheDocument();
	});
});
