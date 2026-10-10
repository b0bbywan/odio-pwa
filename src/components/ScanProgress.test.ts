import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ScanProgress from './ScanProgress.svelte';
import { Scanner } from '../lib/scanner.svelte';

function scannerWith(state: Partial<Scanner>): Scanner {
	return Object.assign(new Scanner(), state);
}

describe('ScanProgress', () => {
	test('while running, shows the finished steps, the current one and its progress', () => {
		const scanner = scannerWith({
			phase: 'running',
			steps: [{ label: 'Common networks', detail: 'none active' }],
			running: 'Sweeping 192.168.0.0/16…',
			progress: { done: 96, total: 224 },
		});
		render(ScanProgress, { scanner });
		expect(screen.getByText('Common networks')).toBeInTheDocument();
		expect(screen.getByText('none active')).toBeInTheDocument();
		expect(screen.getByText('Sweeping 192.168.0.0/16…')).toBeInTheDocument();
		expect(screen.getByText('96 / 224')).toBeInTheDocument();
		const bar = screen.getByRole('progressbar', { name: 'Sweeping 192.168.0.0/16…' });
		expect(bar).toHaveAttribute('value', '96');
		expect(bar).toHaveAttribute('max', '224');
	});

	test('once done, only the steps remain', () => {
		const scanner = scannerWith({
			phase: 'done',
			steps: [
				{ label: 'Common networks', detail: 'none active' },
				{ label: '192.168.0.0/16', detail: 'none active' },
			],
			running: 'Sweeping 192.168.0.0/16…',
		});
		render(ScanProgress, { scanner });
		expect(screen.getAllByText('none active')).toHaveLength(2);
		expect(screen.queryByText('Sweeping 192.168.0.0/16…')).not.toBeInTheDocument();
		expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
	});
});
