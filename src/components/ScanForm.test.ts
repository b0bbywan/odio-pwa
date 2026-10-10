import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ScanForm from './ScanForm.svelte';
import { Scanner } from '../lib/scanner.svelte';

function renderForm(overrides: Partial<{ scanner: Scanner; focus: boolean; onscan: () => void; oncancel: () => void }> = {}) {
	const props = { scanner: new Scanner(), onscan: vi.fn(), oncancel: vi.fn(), ...overrides };
	render(ScanForm, props);
	return props;
}

const target = () => screen.getByPlaceholderText('192.168.1.0/24');

describe('ScanForm', () => {
	test('starts with an empty target and the default port', () => {
		renderForm();
		expect(target()).toHaveValue('');
		expect(screen.getByRole('spinbutton')).toHaveValue(8018);
		expect(screen.getByText(/Leave empty to look for your network automatically/)).toBeInTheDocument();
	});

	test('writes the target and port to the scanner', async () => {
		const { scanner } = renderForm();
		await fireEvent.input(target(), { target: { value: '10.0.0.0/24' } });
		await fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '8080' } });
		expect(scanner).toMatchObject({ target: '10.0.0.0/24', port: 8080 });
	});

	test('"Scan" calls onscan, "Cancel" calls oncancel', async () => {
		const { onscan, oncancel } = renderForm();
		await fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
		expect(onscan).toHaveBeenCalledOnce();
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(oncancel).toHaveBeenCalledOnce();
	});

	test('shows why the target was refused', () => {
		const scanner = new Scanner();
		scanner.error = 'Network too large (max /22)';
		renderForm({ scanner });
		expect(screen.getByText('Network too large (max /22)')).toBeInTheDocument();
		expect(target()).toHaveAttribute('aria-invalid', 'true');
		expect(screen.queryByText(/Leave empty/)).not.toBeInTheDocument();
	});

	test('focuses the target only when asked to', () => {
		renderForm();
		expect(target()).not.toHaveFocus();
		renderForm({ focus: true });
		expect(screen.getAllByPlaceholderText('192.168.1.0/24')[1]).toHaveFocus();
	});
});
