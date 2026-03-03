import type { OdioServerInfo } from './types';
import { connectSSE } from './sse';
import { probeInstance } from './api';

const BACKOFF_INITIAL_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
export const GIVE_UP_AFTER_MS = 90_000;

export interface ConnectionCallbacks {
	onStatus(status: 'probing' | 'online' | 'offline'): void;
	onServerInfo(info: OdioServerInfo): void;
	onGiveUp(): void;
	onPowerAction?(action: 'reboot' | 'poweroff'): void;
}

/**
 * Manages a connection to one odio-api instance with exponential backoff retry.
 *
 * SSE path (useSSE = true):
 *   probe /server → open SSE → on disconnect → retry with backoff → … → give up after 90 s
 *   If SSE errors before ever opening (/events returns 404 or not supported),
 *   the connection permanently falls back to probe-only for this instance.
 *
 * Probe-only path (useSSE = false, or after SSE proved unsupported):
 *   probe /server → wait 30 s → probe again → … → give up after 90 s of consecutive failures
 *
 * Returns a destroy() function that cancels everything immediately.
 */
export function createConnection(
	host: string,
	port: number,
	callbacks: ConnectionCallbacks,
	options: { useSSE?: boolean } = {},
): () => void {
	let destroyed = false;
	let retryTimer: ReturnType<typeof setTimeout> | null = null;
	let closeSSE: (() => void) | null = null;
	let backoffMs = BACKOFF_INITIAL_MS;
	let failingSince: number | null = null;

	// Once SSE has opened at least once we know it's supported.
	// If onSSEDisconnect fires before this becomes true, SSE is not supported
	// and we permanently fall back to probe-only for this connection.
	let sseEverOpened = false;
	let effectiveUseSSE = options.useSSE ?? true;

	function destroy() {
		destroyed = true;
		if (retryTimer !== null) {
			clearTimeout(retryTimer);
			retryTimer = null;
		}
		closeSSE?.();
		closeSSE = null;
	}

	function scheduleRetry() {
		if (destroyed || retryTimer !== null) return;
		const now = Date.now();
		if (failingSince === null) {
			failingSince = now;
		} else if (now - failingSince >= GIVE_UP_AFTER_MS) {
			callbacks.onGiveUp();
			return;
		}
		retryTimer = setTimeout(() => {
			retryTimer = null;
			if (!destroyed) attempt();
		}, backoffMs);
		backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS);
	}

	// Called when the probe itself fails (server unreachable).
	// Does NOT affect SSE support state.
	function onProbeFailure() {
		if (!destroyed) callbacks.onStatus('offline');
		scheduleRetry();
	}

	// Called when the SSE connection drops or errors.
	// If SSE never opened, the endpoint is not supported → switch to probe-only.
	// In that case the probe already succeeded so keep status 'online'.
	function onSSEDisconnect() {
		const wasOpen = sseEverOpened;
		if (!sseEverOpened) {
			effectiveUseSSE = false;
		}
		closeSSE?.();
		closeSSE = null;
		if (wasOpen && !destroyed) callbacks.onStatus('offline');
		scheduleRetry();
	}

	async function attempt() {
		if (destroyed) return;
		// Show 'probing' only on the first attempt — during retries stay 'offline'
		// to avoid red→yellow flickering on the homepage for a known-down server.
		if (failingSince === null) callbacks.onStatus('probing');
		let info: OdioServerInfo;
		try {
			info = await probeInstance(host, port);
		} catch {
			if (!destroyed) onProbeFailure();
			return;
		}
		if (destroyed) return;

		// Probe succeeded — reset failure tracking
		failingSince = null;
		backoffMs = BACKOFF_INITIAL_MS;
		callbacks.onServerInfo(info);
		callbacks.onStatus('online');

		if (!effectiveUseSSE) {
			// Probe-only: schedule next probe at the steady-state interval
			retryTimer = setTimeout(() => {
				retryTimer = null;
				if (!destroyed) attempt();
			}, BACKOFF_MAX_MS);
			return;
		}

		closeSSE = connectSSE(
			host,
			port,
			async () => {
				if (destroyed) return;
				sseEverOpened = true;
				failingSince = null;
				backoffMs = BACKOFF_INITIAL_MS;
				callbacks.onStatus('online');
				// Refresh server info opportunistically; failure is non-fatal
				try {
					const fresh = await probeInstance(host, port);
					if (!destroyed) callbacks.onServerInfo(fresh);
				} catch { /* SSE is open, keep going */ }
			},
			() => {
				if (!destroyed) callbacks.onStatus('online');
			},
			onSSEDisconnect,
			{ onPowerAction: callbacks.onPowerAction },
		);
	}

	attempt();
	return destroy;
}
