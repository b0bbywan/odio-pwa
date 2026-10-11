import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import SavePrompt from './SavePrompt.svelte';

const noop = () => {};

function renderPrompt(overrides: Partial<{
	displayName: string;
	onsave: () => void;
	ondiscard: () => void;
	oncancel: () => void;
}> = {}) {
	return render(SavePrompt, {
		displayName: 'Living Room',
		onsave: noop,
		ondiscard: noop,
		oncancel: noop,
		...overrides,
	});
}

// ── render ────────────────────────────────────────────────────────────────────

describe('SavePrompt — render', () => {
	test('shows the dialog with the display name', () => {
		renderPrompt({ displayName: 'Living Room' });
		expect(screen.getByRole('dialog', { name: /save this instance/i })).toBeInTheDocument();
		expect(screen.getByText(/Add Living Room to your list/)).toBeInTheDocument();
	});

	test('renders Save / Don\'t save / Cancel buttons', () => {
		renderPrompt();
		expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /don't save/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
	});
});

// ── actions ───────────────────────────────────────────────────────────────────

describe('SavePrompt — actions', () => {
	test('"Save" calls onsave', async () => {
		const onsave = vi.fn();
		renderPrompt({ onsave });
		await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
		expect(onsave).toHaveBeenCalledOnce();
	});

	test('"Don\'t save" calls ondiscard', async () => {
		const ondiscard = vi.fn();
		renderPrompt({ ondiscard });
		await fireEvent.click(screen.getByRole('button', { name: /don't save/i }));
		expect(ondiscard).toHaveBeenCalledOnce();
	});

	test('"Cancel" calls oncancel', async () => {
		const oncancel = vi.fn();
		renderPrompt({ oncancel });
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(oncancel).toHaveBeenCalledOnce();
	});

	test('closing the dialog, as Escape or the backdrop do, calls oncancel', () => {
		const oncancel = vi.fn();
		renderPrompt({ oncancel });
		screen.getByRole<HTMLDialogElement>('dialog').close();
		expect(oncancel).toHaveBeenCalledOnce();
	});
});
