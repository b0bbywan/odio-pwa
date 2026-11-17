// Deep reactive proxy for test fixtures, so a test can change a mocked
// value after render (e.g. an instance status) and the component reacts.
export function reactive<T extends object>(value: T): T {
	const proxy = $state(value);
	return proxy;
}
