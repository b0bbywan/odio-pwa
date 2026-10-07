import type { OdioInstance } from './types';

export function displayName(inst: OdioInstance): string {
	return inst.label || inst.serverInfo?.hostname || `${inst.host}:${inst.port}`;
}

type Status = OdioInstance['status'];

// The UI can be opened: SSE up, or up but missing CORS headers (the iframe
// still loads in that case). A type guard, so `else` branches narrow too.
export function isConnectable(status: Status): status is Extract<Status, 'online' | 'cors'> {
	return status === 'online' || status === 'cors';
}
