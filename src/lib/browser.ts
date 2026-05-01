// HTTPS-served PWAs (e.g. pwa.odio.love) need to talk to HTTP odio-api
// instances on the local network. Firefox and Safari on desktop block this
// as mixed-content; Chromium-based browsers allow it. Mobile browsers tend
// to handle it transparently.

export type UnsupportedReason = 'firefox' | 'safari';

export function detectUnsupportedDesktop(
	ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
	protocol: string = typeof location !== 'undefined' ? location.protocol : '',
): UnsupportedReason | null {
	if (protocol !== 'https:') return null;
	if (!ua) return null;

	const isMobile = /Mobile|Android|iPhone|iPad|iPod/.test(ua);
	if (isMobile) return null;

	if (/Firefox\//.test(ua)) return 'firefox';
	if (/Safari\//.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua)) return 'safari';
	return null;
}
