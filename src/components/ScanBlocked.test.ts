import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ScanBlocked from './ScanBlocked.svelte';

function stubClipboard() {
	const writeText = vi.fn().mockResolvedValue(undefined);
	vi.stubGlobal('navigator', { clipboard: { writeText } });
	return writeText;
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('ScanBlocked', () => {
	test('says the hosts listen on the port but refuse this origin', () => {
		render(ScanBlocked, { count: 6, port: 8018 });
		expect(screen.getByText(/^They listen on port 8018 but don't allow this origin\./)).toBeInTheDocument();
		expect(screen.getByText('api.cors.origins')).toBeInTheDocument();
		expect(screen.getByText(location.origin)).toBeInTheDocument();
	});

	test('agrees with a single host', () => {
		render(ScanBlocked, { count: 1, port: 8080 });
		expect(screen.getByText(/^It listens on port 8080 but doesn't allow this origin\./)).toBeInTheDocument();
	});

	test('counts them when instances were found besides', () => {
		render(ScanBlocked, { count: 4, port: 8018, others: true });
		expect(
			screen.getByText(/^4 other hosts answer on port 8018 but don't allow this origin\./),
		).toBeInTheDocument();
	});

	test('counts a single one when instances were found besides', () => {
		render(ScanBlocked, { count: 1, port: 8018, others: true });
		expect(
			screen.getByText(/^1 other host answers on port 8018 but doesn't allow this origin\./),
		).toBeInTheDocument();
	});

	test('"Copy" copies the origin and says so for a moment', async () => {
		vi.useFakeTimers();
		const writeText = stubClipboard();
		render(ScanBlocked, { count: 6, port: 8018 });
		await fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
		expect(writeText).toHaveBeenCalledExactlyOnceWith(location.origin);
		await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument());
		await vi.advanceTimersByTimeAsync(2000);
		expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
	});

	test('no "Copy" without a clipboard (plain HTTP)', () => {
		vi.stubGlobal('navigator', {});
		render(ScanBlocked, { count: 6, port: 8018 });
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
		expect(screen.getByText(location.origin)).toBeInTheDocument();
	});
});
