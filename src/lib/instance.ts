import type { OdioInstance } from './types';

const DEFAULT_PORT = 8018;

export function displayName(inst: OdioInstance): string {
	return inst.label || inst.serverInfo?.hostname || `${inst.host}:${inst.port}`;
}

type Status = OdioInstance['status'];

// The UI can be opened: SSE up, or up but missing CORS headers (the iframe
// still loads in that case). A type guard, so `else` branches narrow too.
export function isConnectable(status: Status): status is Extract<Status, 'online' | 'cors'> {
	return status === 'online' || status === 'cors';
}

// Router path of an instance's view; the default port is left out.
export function instancePath(host: string, port: number, label?: string): string {
	const base = port === DEFAULT_PORT
		? `/i/${encodeURIComponent(host)}`
		: `/i/${encodeURIComponent(host)}/${port}`;
	if (!label) return base;
	return `${base}?label=${encodeURIComponent(label)}`;
}
