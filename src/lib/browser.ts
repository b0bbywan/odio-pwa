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

// Loopback is a "potentially trustworthy" origin: browsers never treat it as
// mixed content, so a failure there means nothing is listening.
function isLoopback(host: string): boolean {
	const h = host.toLowerCase().replace(/^\[|\]$/g, '');
	return h === 'localhost' || h.endsWith('.localhost') || h === '::1' || /^127\./.test(h);
}

// Whether a failed request to this host can be blamed on mixed-content
// blocking. Chromium exempts private IPs and .local hosts, so on Chromium
// (and mobile) an unreachable instance is just offline.
export function blocksMixedContent(
	host: string,
	ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
	protocol: string = typeof location !== 'undefined' ? location.protocol : '',
): boolean {
	return detectUnsupportedDesktop(ua, protocol) !== null && !isLoopback(host);
}
