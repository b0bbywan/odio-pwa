import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

vi.mock('../lib/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('../lib/api')>()),
	sendPowerAction: vi.fn(),
}));

import PowerOffButton from './PowerOffButton.svelte';
import { sendPowerAction } from '../lib/api';

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(sendPowerAction).mockResolvedValue();
});

// detail 1: mouse click; detail 0: keyboard activation (Enter / Space).
async function open(detail = 1) {
	render(PowerOffButton, { host: 'raspodio.local', port: 8018, name: 'raspodio' });
	await fireEvent.click(screen.getByTitle('Power off'), { detail });
}

describe('PowerOffButton', () => {
	test('the icon gives way to a confirmation naming the machine', async () => {
		await open();
		expect(screen.getByRole('alertdialog', { name: 'Power off raspodio?' })).toBeInTheDocument();
		expect(screen.queryByTitle('Power off')).not.toBeInTheDocument();
		expect(sendPowerAction).not.toHaveBeenCalled();
	});

	test('confirm POSTs power_off, then the icon stays disabled', async () => {
		await open();
		await fireEvent.click(screen.getByRole('button', { name: 'Power off' }));
		expect(sendPowerAction).toHaveBeenCalledWith('raspodio.local', 8018, 'power_off');
		expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
		expect(screen.getByTitle('Powering off…')).toBeDisabled();
	});

	test('Cancel brings the icon back', async () => {
		await open();
		await fireEvent.click(screen.getByTitle('Cancel'), { detail: 1 });
		expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
		expect(screen.getByTitle('Power off')).not.toBeDisabled();
		expect(sendPowerAction).not.toHaveBeenCalled();
	});

	test('Escape cancels', async () => {
		await open();
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
	});

	test('a click outside cancels, a click inside does not', async () => {
		await open();
		await fireEvent.click(screen.getByRole('alertdialog'));
		expect(screen.getByRole('alertdialog')).toBeInTheDocument();
		await fireEvent.click(document.body);
		expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
	});

	test('mouse: focus is left alone on open and cancel', async () => {
		await open(1);
		expect(screen.getByTitle('Cancel')).not.toHaveFocus();
		await fireEvent.click(screen.getByTitle('Cancel'), { detail: 1 });
		expect(screen.getByTitle('Power off')).not.toHaveFocus();
	});

	test('keyboard: focus moves to Cancel and back to the icon', async () => {
		await open(0);
		expect(screen.getByTitle('Cancel')).toHaveFocus();
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(screen.getByTitle('Power off')).toHaveFocus();
	});

	test('a failed request stays open to retry', async () => {
		vi.mocked(sendPowerAction).mockRejectedValueOnce(new Error('HTTP 403'));
		await open();
		await fireEvent.click(screen.getByRole('button', { name: 'Power off' }));
		expect(screen.getByTitle('Power off failed')).toHaveTextContent('Retry');
		await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
		expect(sendPowerAction).toHaveBeenCalledTimes(2);
		expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
	});
});
