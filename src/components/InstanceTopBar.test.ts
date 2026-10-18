import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/svelte';
import type { OdioInstance } from '../lib/types';

// Mock appState before importing the component so the component picks up the mock.
vi.mock('../lib/state.svelte', () => ({
	appState: {
		connectableInstances: [] as OdioInstance[],
	},
}));

vi.mock('../lib/nav', () => ({ goHome: vi.fn() }));

import InstanceTopBar from './InstanceTopBar.svelte';
import { appState } from '../lib/state.svelte';
import { goHome } from '../lib/nav';

const inst = (id: string, label: string): OdioInstance => ({
	id,
	host: '192.168.1.1',
	port: 8080,
	label,
	status: 'online',
});

beforeEach(() => {
	vi.clearAllMocks();
	(appState as { connectableInstances: OdioInstance[] }).connectableInstances = [];
});

// ── display ───────────────────────────────────────────────────────────────────

describe('InstanceTopBar — display', () => {
	test('shows the displayName', () => {
		render(InstanceTopBar, { displayName: 'My Pi', currentId: '1', onswitchto: vi.fn() });
		expect(screen.getByText('My Pi')).toBeInTheDocument();
	});

	test('no back button: previous page is the system back button', () => {
		render(InstanceTopBar, { displayName: 'My Pi', currentId: '1', onswitchto: vi.fn() });
		expect(screen.queryByTitle('Back')).not.toBeInTheDocument();
	});

	test('home button goes home when no onhome is provided', async () => {
		render(InstanceTopBar, { displayName: 'My Pi', currentId: '1', onswitchto: vi.fn() });
		await fireEvent.click(screen.getByTitle('Back to list'));
		expect(goHome).toHaveBeenCalledOnce();
	});
});

// ── onback override ───────────────────────────────────────────────────────────

describe('InstanceTopBar — onhome override', () => {
	test('home button calls onhome when provided, not goHome', async () => {
		const onhome = vi.fn();
		render(InstanceTopBar, { displayName: 'My Pi', currentId: '1', onswitchto: vi.fn(), onhome });
		await fireEvent.click(screen.getByTitle('Back to list'));
		expect(onhome).toHaveBeenCalledOnce();
		expect(goHome).not.toHaveBeenCalled();
	});
});

// ── node dashboard button ─────────────────────────────────────────────────────

describe('InstanceTopBar — node dashboard button', () => {
	test('hidden without ondashboard', () => {
		render(InstanceTopBar, { displayName: 'My Pi', currentId: '1', onswitchto: vi.fn() });
		expect(screen.queryByTitle('Node dashboard')).not.toBeInTheDocument();
	});

	test('clicking it calls ondashboard', async () => {
		const ondashboard = vi.fn();
		render(InstanceTopBar, { displayName: 'My Pi', currentId: '1', onswitchto: vi.fn(), ondashboard });
		await fireEvent.click(screen.getByTitle('Node dashboard'));
		expect(ondashboard).toHaveBeenCalledOnce();
	});
});

// ── transient save button ─────────────────────────────────────────────────────

describe('InstanceTopBar — save button', () => {
	test('hidden by default', () => {
		render(InstanceTopBar, { displayName: 'My Pi', currentId: '1', onswitchto: vi.fn() });
		expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
	});

	test('hidden when transient is true but onsave is missing', () => {
		render(InstanceTopBar, { displayName: 'My Pi', currentId: '1', onswitchto: vi.fn(), transient: true });
		expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
	});

	test('hidden when onsave is provided but transient is false', () => {
		render(InstanceTopBar, { displayName: 'My Pi', currentId: '1', onswitchto: vi.fn(), onsave: vi.fn() });
		expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
	});

	test('shown when transient and onsave are both provided', () => {
		render(InstanceTopBar, {
			displayName: 'My Pi', currentId: '1', onswitchto: vi.fn(), transient: true, onsave: vi.fn(),
		});
		expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
	});

	test('clicking it calls onsave', async () => {
		const onsave = vi.fn();
		render(InstanceTopBar, {
			displayName: 'My Pi', currentId: '1', onswitchto: vi.fn(), transient: true, onsave,
		});
		await fireEvent.click(screen.getByRole('button', { name: /save/i }));
		expect(onsave).toHaveBeenCalledOnce();
	});
});

// ── switcher hidden ───────────────────────────────────────────────────────────

describe('InstanceTopBar — switcher hidden', () => {
	test('no switcher button when there is only one online instance', () => {
		(appState as { connectableInstances: OdioInstance[] }).connectableInstances = [inst('1', 'Pi 1')];
		render(InstanceTopBar, { displayName: 'Pi 1', currentId: '1', onswitchto: vi.fn() });
		expect(screen.queryByTitle('Switch instance')).not.toBeInTheDocument();
	});
});

// ── switcher visible ──────────────────────────────────────────────────────────

describe('InstanceTopBar — switcher with multiple instances', () => {
	beforeEach(() => {
		(appState as { connectableInstances: OdioInstance[] }).connectableInstances = [
			inst('1', 'Pi 1'),
			inst('2', 'Pi 2'),
		];
	});

	const dropdown = () => document.querySelector<HTMLDialogElement>('dialog.switcher-dropdown')!;

	test('the name is the switcher button', () => {
		render(InstanceTopBar, { displayName: 'Pi 1', currentId: '1', onswitchto: vi.fn() });
		expect(screen.getByTitle('Switch instance')).toHaveTextContent('Pi 1');
	});

	test('dropdown is closed initially', () => {
		render(InstanceTopBar, { displayName: 'Pi 1', currentId: '1', onswitchto: vi.fn() });
		expect(dropdown()).not.toHaveAttribute('open');
	});

	test('clicking the switcher opens the dropdown', async () => {
		render(InstanceTopBar, { displayName: 'Pi 1', currentId: '1', onswitchto: vi.fn() });
		await fireEvent.click(screen.getByTitle('Switch instance'));
		expect(dropdown()).toHaveAttribute('open');
		expect(within(dropdown()).getByRole('button', { name: 'Pi 2' })).toBeInTheDocument();
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
		expect(dropdown()).not.toHaveAttribute('open');
	});

	test('clicking the backdrop closes the dropdown', async () => {
		render(InstanceTopBar, { displayName: 'Pi 1', currentId: '1', onswitchto: vi.fn() });
		await fireEvent.click(screen.getByTitle('Switch instance'));
		// A click on the backdrop targets the dialog itself
		await fireEvent.click(dropdown());
		expect(dropdown()).not.toHaveAttribute('open');
	});
});
