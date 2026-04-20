const REPO = 'b0bbywan/odio-pwa';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const INCLUDE_PRERELEASE_KEY = 'odio-include-prereleases';

export type ReleaseInfo = {
	version: string;
	url: string;
};

type CacheEntry = {
	checkedAt: number;
	latest: ReleaseInfo | null;
};

// Toggle via devtools: `localStorage.setItem('odio-include-prereleases', 'true')`
function includePrerelease(): boolean {
	try {
		return localStorage.getItem(INCLUDE_PRERELEASE_KEY) === 'true';
	} catch {
		return false;
	}
}

function cacheKey(): string {
	return includePrerelease() ? 'odio-latest-release-pre' : 'odio-latest-release';
}

async function fetchFromApi(): Promise<ReleaseInfo | null> {
	const url = includePrerelease()
		? `https://api.github.com/repos/${REPO}/releases?per_page=1`
		: `https://api.github.com/repos/${REPO}/releases/latest`;
	const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
	if (!res.ok) return null;
	const data = (await res.json()) as
		| { tag_name: string; html_url: string }
		| Array<{ tag_name: string; html_url: string }>;
	const entry = Array.isArray(data) ? data[0] : data;
	if (!entry) return null;
	return {
		version: entry.tag_name.replace(/^v/, ''),
		url: entry.html_url,
	};
}

export async function fetchLatestRelease(current: string): Promise<ReleaseInfo | null> {
	const cached = readCache(current);
	if (cached) return cached.latest;

	try {
		const latest = await fetchFromApi();
		if (!latest) return null;
		if (isNewerVersion(latest.version, current)) {
			writeCache({ checkedAt: Date.now(), latest });
			return latest;
		}
		writeCache({ checkedAt: Date.now(), latest: null });
		return null;
	} catch {
		return null;
	}
}

function readCache(current: string): CacheEntry | null {
	const key = cacheKey();
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as CacheEntry;
		if (Date.now() - parsed.checkedAt > CACHE_TTL_MS) {
			localStorage.removeItem(key);
			return null;
		}
		if (parsed.latest && !isNewerVersion(parsed.latest.version, current)) {
			// We've caught up with the cached "latest" (app was updated).
			// Drop the stale pointer but preserve checkedAt so we don't refetch until TTL.
			const cleaned: CacheEntry = { checkedAt: parsed.checkedAt, latest: null };
			writeCache(cleaned);
			return cleaned;
		}
		return parsed;
	} catch {
		return null;
	}
}

function writeCache(entry: CacheEntry): void {
	try {
		localStorage.setItem(cacheKey(), JSON.stringify(entry));
	} catch {
		// quota exceeded or disabled — ignore
	}
}

// semver-ish compare: returns true if `latest` is newer than `current`.
// Handles MAJOR.MINOR.PATCH with optional -prerelease suffix (rc1, beta2, etc.)
export function isNewerVersion(latest: string, current: string): boolean {
	const l = parseVersion(latest);
	const c = parseVersion(current);
	if (!l || !c) return false;
	if (l.major !== c.major) return l.major > c.major;
	if (l.minor !== c.minor) return l.minor > c.minor;
	if (l.patch !== c.patch) return l.patch > c.patch;
	if (l.pre === c.pre) return false;
	if (!l.pre) return true;
	if (!c.pre) return false;
	return l.pre > c.pre;
}

type ParsedVersion = { major: number; minor: number; patch: number; pre: string | null };

function parseVersion(v: string): ParsedVersion | null {
	const m = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
	if (!m) return null;
	return {
		major: Number(m[1]),
		minor: Number(m[2]),
		patch: Number(m[3]),
		pre: m[4] ?? null,
	};
}
