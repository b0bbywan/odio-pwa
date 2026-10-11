import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Modal from './Modal.svelte';

const children = createRawSnippet(() => ({
	render: () => '<div><h3 id="title">Title</h3><input aria-label="Field" /></div>',
}));

function renderModal(onclose = vi.fn()) {
	const { component } = render(Modal, { class: 'custom', labelledby: 'title', onclose, children });
	return { component, onclose, dialog: screen.getByRole<HTMLDialogElement>('dialog', { name: 'Title' }) };
}

describe('Modal', () => {
	test('opens as a modal dialog around its content', () => {
		const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
		const { dialog } = renderModal();
		expect(showModal).toHaveBeenCalledOnce();
		expect(dialog).toHaveClass('modal', 'custom');
		expect(screen.getByRole('textbox', { name: 'Field' })).toBeInTheDocument();
		showModal.mockRestore();
	});

	test('close() closes the dialog and calls onclose', () => {
		const { component, dialog, onclose } = renderModal();
		component.close();
		expect(dialog.open).toBe(false);
		expect(onclose).toHaveBeenCalledOnce();
	});

	test('closing natively, as Escape does, calls onclose', () => {
		const { dialog, onclose } = renderModal();
		dialog.close();
		expect(onclose).toHaveBeenCalledOnce();
	});

	test('clicking the backdrop closes', async () => {
		const { dialog, onclose } = renderModal();
		await fireEvent.pointerDown(dialog);
		await fireEvent.click(dialog);
		expect(onclose).toHaveBeenCalledOnce();
	});

	test('clicking inside does not close', async () => {
		const { onclose } = renderModal();
		const field = screen.getByRole('textbox', { name: 'Field' });
		await fireEvent.pointerDown(field);
		await fireEvent.click(field);
		expect(onclose).not.toHaveBeenCalled();
	});

	test('a press started inside and released on the backdrop does not close', async () => {
		const { dialog, onclose } = renderModal();
		await fireEvent.pointerDown(screen.getByRole('textbox', { name: 'Field' }));
		await fireEvent.click(dialog);
		expect(onclose).not.toHaveBeenCalled();
	});
});
