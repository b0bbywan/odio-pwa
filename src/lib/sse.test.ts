import { describe, test, expect, vi, beforeEach } from 'vitest';
import { connectSSE } from './sse';
import { mpdPlayer } from '../test/fixtures';

// Minimal EventSource mock — lets tests fire events synchronously
class MockEventSource {
	static last: MockEventSource | null = null;
	url: string;
	close = vi.fn();
	private handlers = new Map<string, ((e: MessageEvent) => void)[]>();

	constructor(url: string) {
		this.url = url;
		MockEventSource.last = this;
	}

	addEventListener(type: string, handler: (e: MessageEvent) => void) {
		this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
	}

	emit(type: string, data?: string) {
		const event = { data } as MessageEvent;
		this.handlers.get(type)?.forEach((h) => h(event));
	}
}

vi.stubGlobal('EventSource', MockEventSource);

function lastES() {
	return MockEventSource.last!;
}

beforeEach(() => {
	MockEventSource.last = null;
	vi.clearAllMocks();
});

describe('connectSSE — URL', () => {
	test('always subscribes to server.info', () => {
		connectSSE('host', 8080, vi.fn(), vi.fn(), vi.fn());
		expect(lastES().url).toContain('types=server.info');
	});

	test('adds power.action when onPowerAction is provided', () => {
		connectSSE('host', 8080, vi.fn(), vi.fn(), vi.fn(), { onPowerAction: vi.fn() });
		expect(lastES().url).toContain('power.action');
	});

	test('does not add power.action without callback', () => {
		connectSSE('host', 8080, vi.fn(), vi.fn(), vi.fn());
		expect(lastES().url).not.toContain('power.action');
	});
});

describe('connectSSE — open event', () => {
	test('calls onOpen', () => {
		const onOpen = vi.fn();
		connectSSE('host', 8080, onOpen, vi.fn(), vi.fn());
		lastES().emit('open');
		expect(onOpen).toHaveBeenCalledOnce();
	});
});

describe('connectSSE — server.info event', () => {
	test('calls onAlive for "connected"', () => {
		const onAlive = vi.fn();
		connectSSE('host', 8080, vi.fn(), onAlive, vi.fn());
		lastES().emit('server.info', '"connected"');
		expect(onAlive).toHaveBeenCalledOnce();
	});

	test('calls onAlive for "love" keepalive', () => {
		const onAlive = vi.fn();
		connectSSE('host', 8080, vi.fn(), onAlive, vi.fn());
		lastES().emit('server.info', '"love"');
		expect(onAlive).toHaveBeenCalledOnce();
	});

	test('calls onOffline for "bye"', () => {
		const onAlive = vi.fn();
		const onOffline = vi.fn();
		connectSSE('host', 8080, vi.fn(), onAlive, onOffline);
		lastES().emit('server.info', '"bye"');
		expect(onOffline).toHaveBeenCalledOnce();
		expect(onAlive).not.toHaveBeenCalled();
	});

	test('calls onAlive for unknown data (forward compat)', () => {
		const onAlive = vi.fn();
		connectSSE('host', 8080, vi.fn(), onAlive, vi.fn());
		lastES().emit('server.info', '"future-value"');
		expect(onAlive).toHaveBeenCalledOnce();
	});
});

describe('connectSSE — error event', () => {
	test('calls onOffline', () => {
		const onOffline = vi.fn();
		connectSSE('host', 8080, vi.fn(), vi.fn(), onOffline);
		lastES().emit('error');
		expect(onOffline).toHaveBeenCalledOnce();
	});
});

describe('connectSSE — power.action event', () => {
	test('calls onPowerAction with reboot', () => {
		const onPowerAction = vi.fn();
		connectSSE('host', 8080, vi.fn(), vi.fn(), vi.fn(), { onPowerAction });
		lastES().emit('power.action', JSON.stringify({ action: 'reboot' }));
		expect(onPowerAction).toHaveBeenCalledWith('reboot');
	});

	test('calls onPowerAction with poweroff', () => {
		const onPowerAction = vi.fn();
		connectSSE('host', 8080, vi.fn(), vi.fn(), vi.fn(), { onPowerAction });
		lastES().emit('power.action', JSON.stringify({ action: 'poweroff' }));
		expect(onPowerAction).toHaveBeenCalledWith('poweroff');
	});

	test('ignores malformed power.action data', () => {
		const onPowerAction = vi.fn();
		connectSSE('host', 8080, vi.fn(), vi.fn(), vi.fn(), { onPowerAction });
		expect(() => lastES().emit('power.action', 'not-json')).not.toThrow();
		expect(onPowerAction).not.toHaveBeenCalled();
	});
});

describe('connectSSE — player events', () => {
	const player = mpdPlayer();

	function playerCallbacks() {
		return { onUpsert: vi.fn(), onRemove: vi.fn(), onPosition: vi.fn() };
	}

	test('subscribes to player.* types when player callbacks are provided', () => {
		connectSSE('host', 8080, vi.fn(), vi.fn(), vi.fn(), { players: playerCallbacks() });
		expect(lastES().url).toContain(
			'player.added,player.updated,player.removed,player.position',
		);
	});

	test('does not subscribe to player.* types without callbacks', () => {
		connectSSE('host', 8080, vi.fn(), vi.fn(), vi.fn());
		expect(lastES().url).not.toContain('player.');
	});

	test.each(['player.added', 'player.updated'])('%s unwraps the envelope', (type) => {
		const players = playerCallbacks();
		connectSSE('host', 8080, vi.fn(), vi.fn(), vi.fn(), { players });
		lastES().emit(type, JSON.stringify({ data: player, emitted_at: 1791324393825 }));
		expect(players.onUpsert).toHaveBeenCalledWith(player);
	});

	test('player.removed passes the bus name', () => {
		const players = playerCallbacks();
		connectSSE('host', 8080, vi.fn(), vi.fn(), vi.fn(), { players });
		lastES().emit('player.removed', JSON.stringify({ bus_name: player.bus_name }));
		expect(players.onRemove).toHaveBeenCalledWith(player.bus_name);
	});

	test('player.position passes the updates', () => {
		const players = playerCallbacks();
		const updates = [
			{
				bus_name: player.bus_name,
				emitted_at: 1791324393825,
				position: 1456704000,
				track_id: '/org/mpris/MediaPlayer2/Track/3',
			},
		];
		connectSSE('host', 8080, vi.fn(), vi.fn(), vi.fn(), { players });
		lastES().emit('player.position', JSON.stringify(updates));
		expect(players.onPosition).toHaveBeenCalledWith(updates);
	});

	test('ignores malformed player data', () => {
		const players = playerCallbacks();
		connectSSE('host', 8080, vi.fn(), vi.fn(), vi.fn(), { players });
		for (const type of ['player.updated', 'player.removed', 'player.position']) {
			expect(() => lastES().emit(type, 'not-json')).not.toThrow();
		}
		expect(players.onUpsert).not.toHaveBeenCalled();
		expect(players.onRemove).not.toHaveBeenCalled();
		expect(players.onPosition).not.toHaveBeenCalled();
	});
});

describe('connectSSE — cleanup', () => {
	test('returned function closes the EventSource', () => {
		const cleanup = connectSSE('host', 8080, vi.fn(), vi.fn(), vi.fn());
		cleanup();
		expect(lastES().close).toHaveBeenCalledOnce();
	});
});
