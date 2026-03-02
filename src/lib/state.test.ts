import { describe, test, expect } from 'vitest';
import { byPriority } from './state.svelte';
import type { OdioInstance } from './types';

function makeInstance(overrides: Partial<OdioInstance> = {}): OdioInstance {
	return {
		id: crypto.randomUUID(),
		host: '192.168.1.1',
		port: 8080,
		status: 'unknown',
		serverInfo: null,
		...overrides,
	};
}

describe('byPriority', () => {
	test('power-backend instance sorts before one without', () => {
		const withPower = makeInstance({
			serverInfo: {
				hostname: 'a',
				os_platform: 'linux',
				os_version: '6.1',
				api_sw: 'odio',
				api_version: '1.0',
				backends: { mpris: false, pulseaudio: false, systemd: false, zeroconf: false, power: true },
			},
		});
		const withoutPower = makeInstance({ serverInfo: null });
		expect([withoutPower, withPower].sort(byPriority)).toEqual([withPower, withoutPower]);
	});

	test('more recently connected instance sorts first when power status is equal', () => {
		const older = makeInstance({ connectedAt: 1000 });
		const newer = makeInstance({ connectedAt: 2000 });
		expect([older, newer].sort(byPriority)).toEqual([newer, older]);
	});

	test('instance with connectedAt sorts before one without', () => {
		const withDate = makeInstance({ connectedAt: 1000 });
		const withoutDate = makeInstance();
		expect([withoutDate, withDate].sort(byPriority)).toEqual([withDate, withoutDate]);
	});

	test('power backend takes priority over more recent connectedAt', () => {
		const powerOlder = makeInstance({
			connectedAt: 1000,
			serverInfo: {
				hostname: 'a',
				os_platform: 'linux',
				os_version: '6.1',
				api_sw: 'odio',
				api_version: '1.0',
				backends: { mpris: false, pulseaudio: false, systemd: false, zeroconf: false, power: true },
			},
		});
		const noPowerNewer = makeInstance({ connectedAt: 9999 });
		expect([noPowerNewer, powerOlder].sort(byPriority)).toEqual([powerOlder, noPowerNewer]);
	});

	test('two instances without connectedAt maintain stable relative order', () => {
		const a = makeInstance();
		const b = makeInstance();
		const sorted = [a, b].sort(byPriority);
		expect(sorted).toHaveLength(2);
	});
});
