import '@testing-library/jest-dom/vitest';

// jsdom has no modal dialog support
HTMLDialogElement.prototype.showModal = function () {
	this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close = function () {
	if (!this.open) return;
	this.removeAttribute('open');
	this.dispatchEvent(new Event('close'));
};
