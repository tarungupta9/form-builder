import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/*
 * React Router builds a `Request` for every navigation, passing an `AbortSignal`. Under jsdom
 * the signal comes from jsdom's `AbortController`, but `Request` is Node's own (undici), which
 * rejects a signal from another realm, so every navigation in a test fails. Browsers have one
 * realm and are not affected. The tests never abort a navigation, so the signal is dropped.
 */
class SameRealmRequest extends Request {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, init && { ...init, signal: undefined });
  }
}
globalThis.Request = SameRealmRequest;

/*
 * jsdom has `<dialog>` but not `showModal()` or `close()`. This stands in for the browser
 * behaviour the app relies on: the `open` attribute, focus on the first control, Escape closing
 * the dialog, and the `close` event. It does not make the page behind inert; no test needs it.
 */
const FOCUSABLE = 'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])';
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
    this.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  document.addEventListener('keydown', (event) => {
    const dialog = document.querySelector('dialog[open]');
    if (event.key === 'Escape' && dialog instanceof HTMLDialogElement) dialog.close();
  });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
