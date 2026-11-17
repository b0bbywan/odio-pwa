import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import UpdatePrompt from './UpdatePrompt.svelte';

describe('UpdatePrompt', () => {
	test('names the new version', () => {
		render(UpdatePrompt, { version: '0.9.0', onreload: vi.fn(), onclose: vi.fn() });
		expect(screen.getByRole('status')).toHaveTextContent('odio-api was updated to 0.9.0');
	});

	test('Reload calls onreload', async () => {
		const onreload = vi.fn();
		render(UpdatePrompt, { version: '0.9.0', onreload, onclose: vi.fn() });
		await fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
		expect(onreload).toHaveBeenCalledOnce();
	});

	test('Close calls onclose', async () => {
		const onclose = vi.fn();
		render(UpdatePrompt, { version: '0.9.0', onreload: vi.fn(), onclose });
		await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(onclose).toHaveBeenCalledOnce();
	});
});
