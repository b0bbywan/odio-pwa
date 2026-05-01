import { describe, test, expect } from 'vitest';
import { detectUnsupportedDesktop } from './browser';

const FIREFOX_DESKTOP =
	'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
const FIREFOX_ANDROID =
	'Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0';
const SAFARI_MAC =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const SAFARI_IOS =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const CHROME_DESKTOP =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const EDGE_DESKTOP =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0';
const CHROME_ANDROID =
	'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

describe('detectUnsupportedDesktop', () => {
	test('Firefox desktop on HTTPS is flagged', () => {
		expect(detectUnsupportedDesktop(FIREFOX_DESKTOP, 'https:')).toBe('firefox');
	});

	test('Safari desktop on HTTPS is flagged', () => {
		expect(detectUnsupportedDesktop(SAFARI_MAC, 'https:')).toBe('safari');
	});

	test('Chrome desktop on HTTPS is supported', () => {
		expect(detectUnsupportedDesktop(CHROME_DESKTOP, 'https:')).toBe(null);
	});

	test('Edge desktop on HTTPS is supported (Chrome/Safari tokens but Edg/ wins)', () => {
		expect(detectUnsupportedDesktop(EDGE_DESKTOP, 'https:')).toBe(null);
	});

	test('Firefox Android is not flagged (mobile)', () => {
		expect(detectUnsupportedDesktop(FIREFOX_ANDROID, 'https:')).toBe(null);
	});

	test('Safari iOS is not flagged (mobile)', () => {
		expect(detectUnsupportedDesktop(SAFARI_IOS, 'https:')).toBe(null);
	});

	test('Chrome Android is not flagged', () => {
		expect(detectUnsupportedDesktop(CHROME_ANDROID, 'https:')).toBe(null);
	});

	test('HTTP context never flags (no mixed-content concern)', () => {
		expect(detectUnsupportedDesktop(FIREFOX_DESKTOP, 'http:')).toBe(null);
		expect(detectUnsupportedDesktop(SAFARI_MAC, 'http:')).toBe(null);
	});

	test('empty UA returns null', () => {
		expect(detectUnsupportedDesktop('', 'https:')).toBe(null);
	});
});
