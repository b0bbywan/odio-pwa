import { describe, test, expect } from 'vitest';
import { displayName, isConnectable } from './instance';
import type { OdioInstance, OdioServerInfo } from './types';

const base: OdioInstance = { id: 'x', host: '192.168.1.6', port: 8018, status: 'online' };
const serverInfo: OdioServerInfo = {
	hostname: 'raspodio',
	os_platform: 'linux/arm',
	os_version: '13',
	api_sw: 'odio-api',
	api_version: 'v0.17.4',
	backends: { mpris: true, pulseaudio: true, systemd: true, zeroconf: true },
};

describe('displayName', () => {
	test('prefers the label', () => {
		expect(displayName({ ...base, label: 'Salon', serverInfo })).toBe('Salon');
	});

	test('falls back to the server hostname', () => {
		expect(displayName({ ...base, serverInfo })).toBe('raspodio');
	});

	test('falls back to host:port', () => {
		expect(displayName(base)).toBe('192.168.1.6:8018');
	});
});

describe('isConnectable', () => {
	test.each([
		['online', true],
		['cors', true],
		['offline', false],
		['blocked', false],
		['probing', false],
		['unknown', false],
	] as const)('%s → %s', (status, expected) => {
		expect(isConnectable(status)).toBe(expected);
	});
});
