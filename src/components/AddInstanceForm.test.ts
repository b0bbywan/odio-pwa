import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import type { OdioInstance } from '../lib/types';

vi.mock('../lib/state.svelte', () => ({
	appState: {
		addInstance: vi.fn(),
		updateInstance: vi.fn(),
	},
}));

import AddInstanceForm from './AddInstanceForm.svelte';
import { appState } from '../lib/state.svelte';

const editTarget: OdioInstance = {
	id: 'abc',
	host: '192.168.1.1',
	port: 8080,
	label: 'My Pi',
	status: 'online',
};

beforeEach(() => vi.clearAllMocks());

// ── add mode ──────────────────────────────────────────────────────────────────

describe('AddInstanceForm — add mode', () => {
	test('shows "Add Instance" heading', () => {
		render(AddInstanceForm, { onclose: vi.fn() });
		expect(screen.getByRole('heading', { name: 'Add Instance' })).toBeInTheDocument();
	});

	test('submit button says "Add"', () => {
		render(AddInstanceForm, { onclose: vi.fn() });
		expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
	});

	test('cancel button calls onclose', async () => {
		const onclose = vi.fn();
		render(AddInstanceForm, { onclose });
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(onclose).toHaveBeenCalledOnce();
	});

	test('submit with empty host does not call addInstance', async () => {
		render(AddInstanceForm, { onclose: vi.fn() });
		await fireEvent.click(screen.getByRole('button', { name: 'Add' }));
		expect(appState.addInstance).not.toHaveBeenCalled();
	});

	test('submit calls addInstance with host and port', async () => {
		const onclose = vi.fn();
		render(AddInstanceForm, { onclose });
		await fireEvent.input(screen.getByPlaceholderText('192.168.1.100'), {
			target: { value: '10.0.0.1' },
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Add' }));
		expect(appState.addInstance).toHaveBeenCalledWith('10.0.0.1', expect.any(Number), undefined);
		expect(onclose).toHaveBeenCalledOnce();
	});

	test('label is forwarded when provided', async () => {
		render(AddInstanceForm, { onclose: vi.fn() });
		await fireEvent.input(screen.getByPlaceholderText('192.168.1.100'), {
			target: { value: '10.0.0.1' },
		});
		await fireEvent.input(screen.getByPlaceholderText('Living Room'), {
			target: { value: 'Studio' },
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Add' }));
		expect(appState.addInstance).toHaveBeenCalledWith('10.0.0.1', expect.any(Number), 'Studio');
	});

	test('blank label is treated as undefined', async () => {
		render(AddInstanceForm, { onclose: vi.fn() });
		await fireEvent.input(screen.getByPlaceholderText('192.168.1.100'), {
			target: { value: '10.0.0.1' },
		});
		await fireEvent.input(screen.getByPlaceholderText('Living Room'), {
			target: { value: '   ' },
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Add' }));
		expect(appState.addInstance).toHaveBeenCalledWith('10.0.0.1', expect.any(Number), undefined);
	});
});

// ── edit mode ─────────────────────────────────────────────────────────────────

describe('AddInstanceForm — edit mode', () => {
	test('shows "Edit Instance" heading', () => {
		render(AddInstanceForm, { editInstance: editTarget, onclose: vi.fn() });
		expect(screen.getByRole('heading', { name: 'Edit Instance' })).toBeInTheDocument();
	});

	test('submit button says "Save"', () => {
		render(AddInstanceForm, { editInstance: editTarget, onclose: vi.fn() });
		expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
	});

	test('host field is pre-filled', () => {
		render(AddInstanceForm, { editInstance: editTarget, onclose: vi.fn() });
		expect(screen.getByPlaceholderText('192.168.1.100')).toHaveValue('192.168.1.1');
	});

	test('label field is pre-filled', () => {
		render(AddInstanceForm, { editInstance: editTarget, onclose: vi.fn() });
		expect(screen.getByPlaceholderText('Living Room')).toHaveValue('My Pi');
	});

	test('submit calls updateInstance with the instance id and current values', async () => {
		const onclose = vi.fn();
		render(AddInstanceForm, { editInstance: editTarget, onclose });
		await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
		expect(appState.updateInstance).toHaveBeenCalledWith('abc', '192.168.1.1', 8080, 'My Pi');
		expect(onclose).toHaveBeenCalledOnce();
	});
});
