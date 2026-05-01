import { describe, test, expect } from 'vitest';
import { isNewerVersion } from './github';

describe('isNewerVersion', () => {
	describe('basic semver', () => {
		test('newer patch is newer', () => {
			expect(isNewerVersion('0.3.5', '0.3.4')).toBe(true);
		});

		test('newer minor is newer', () => {
			expect(isNewerVersion('0.4.0', '0.3.9')).toBe(true);
		});

		test('newer major is newer', () => {
			expect(isNewerVersion('1.0.0', '0.9.9')).toBe(true);
		});

		test('same version is not newer', () => {
			expect(isNewerVersion('0.3.4', '0.3.4')).toBe(false);
		});

		test('older patch is not newer', () => {
			expect(isNewerVersion('0.3.3', '0.3.4')).toBe(false);
		});

		test('older minor is not newer', () => {
			expect(isNewerVersion('0.2.9', '0.3.0')).toBe(false);
		});
	});

	describe('prerelease (-suffix)', () => {
		test('stable is newer than its rc', () => {
			expect(isNewerVersion('0.3.4', '0.3.4-rc1')).toBe(true);
		});

		test('rc is not newer than stable of same version', () => {
			expect(isNewerVersion('0.3.4-rc1', '0.3.4')).toBe(false);
		});

		test('higher rc is newer than lower rc', () => {
			expect(isNewerVersion('0.3.4-rc2', '0.3.4-rc1')).toBe(true);
		});

		test('same rc is not newer', () => {
			expect(isNewerVersion('0.3.4-rc1', '0.3.4-rc1')).toBe(false);
		});

		test('newer patch beats prerelease comparison', () => {
			expect(isNewerVersion('0.3.5', '0.3.4-rc1')).toBe(true);
			expect(isNewerVersion('0.3.4-rc1', '0.3.5')).toBe(false);
		});
	});

	describe('build metadata (+suffix)', () => {
		test('build metadata is ignored for precedence — same tag is not newer', () => {
			expect(isNewerVersion('0.3.4', '0.3.4+1.g838e075')).toBe(false);
		});

		test('current ahead of tag is not behind a fresh release of that tag', () => {
			// On Vercel: built version is `0.3.4+1.g838e075`, latest GH release is `0.3.4`.
			// Update indicator must NOT show.
			expect(isNewerVersion('0.3.4', '0.3.4+3.gabc1234')).toBe(false);
		});

		test('newer release detected even when current has build metadata', () => {
			expect(isNewerVersion('0.3.5', '0.3.4+1.g838e075')).toBe(true);
		});

		test('rc is not newer than stable + build metadata', () => {
			expect(isNewerVersion('0.3.4-rc1', '0.3.4+1.g838e075')).toBe(false);
		});

		test('build metadata on both sides is ignored', () => {
			expect(isNewerVersion('0.3.4+2.gxxx', '0.3.4+1.gyyy')).toBe(false);
		});
	});

	describe('malformed input', () => {
		test('returns false for unparseable latest', () => {
			expect(isNewerVersion('not-a-version', '0.3.4')).toBe(false);
		});

		test('returns false for unparseable current', () => {
			expect(isNewerVersion('0.3.4', 'not-a-version')).toBe(false);
		});

		test('returns false for empty strings', () => {
			expect(isNewerVersion('', '')).toBe(false);
		});
	});
});
