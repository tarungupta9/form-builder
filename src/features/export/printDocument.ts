import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { type ExportDocument, pdfFileName } from './exportModel';
import printStyles from './print.css?inline';
import { ResponseDocument } from './ResponseDocument';

/** How long after `print()` returns to give up waiting for `afterprint` and end the busy state. */
const HANDED_OVER_MS = 500;
/** When to remove the frame if the browser never fires `afterprint`. */
const REMOVE_FRAME_AFTER_MS = 60_000;
/** A stylesheet or font that has not loaded by then is printed without, rather than never. */
const STYLES_TIMEOUT_MS = 3_000;

/**
 * Prints a response through the browser's own print dialog, where the respondent picks
 * "Save as PDF" (ADR 0011: no PDF library, and hand-written PDF bytes are left for later).
 *
 * The document is rendered into an off-screen frame, so only the response is printed, never
 * the app around it. The returned promise settles once the dialog has been handed over: on
 * `afterprint`, or shortly after `print()` returns where the browser does not block on it,
 * whichever comes first. It rejects when the browser will not print. The frame itself stays
 * until `afterprint` (or a minute), because removing it early prints a blank page in browsers
 * whose `print()` returns before the dialog is done. Focus goes back to whatever had it (the
 * button that was pressed), since printing has to focus the frame.
 */
export async function printDocument(document: ExportDocument): Promise<void> {
  const page = window.document;
  const fileName = pdfFileName(document);
  const previousTitle = page.title;
  const previousFocus = page.activeElement instanceof HTMLElement ? page.activeElement : null;
  const frame = createPrintFrame(page);
  let root: Root | null = null;
  const removeFrame = () => {
    root?.unmount();
    root = null;
    frame.remove();
  };

  try {
    // `srcdoc` loads asynchronously in every browser, so the frame's document is final once
    // `load` fires. An `about:blank` frame is replaced on load in Firefox, losing its content.
    const loaded = new Promise((resolve) => {
      frame.addEventListener('load', resolve, { once: true });
    });
    page.body.append(frame);
    await loaded;
    const frameWindow = frame.contentWindow;
    const frameDocument = frameWindow?.document;
    if (!frameWindow || !frameDocument) throw new Error('The print frame has no window.');

    frameDocument.documentElement.lang = page.documentElement.lang;
    // Browsers suggest the file name from the title. Some read the frame's, some the page's.
    frameDocument.title = fileName;
    await copyStyles(page, frameDocument);
    const frameRoot = createRoot(frameDocument.body);
    root = frameRoot;
    flushSync(() => {
      frameRoot.render(createElement(ResponseDocument, { document }));
    });

    page.title = fileName;
    await new Promise<void>((resolve) => {
      frameWindow.addEventListener(
        'afterprint',
        () => {
          resolve();
          removeFrame();
        },
        { once: true },
      );
      frameWindow.focus(); // Safari prints the parent page unless the frame has focus.
      frameWindow.print(); // A throw here rejects this promise, and so the whole call.
      setTimeout(resolve, HANDED_OVER_MS);
    });
    setTimeout(removeFrame, REMOVE_FRAME_AFTER_MS);
  } catch (error) {
    removeFrame();
    throw error;
  } finally {
    page.title = previousTitle;
    if (previousFocus?.isConnected) previousFocus.focus();
  }
}

/**
 * Off screen at A4 size rather than `display: none`, which Safari prints as a blank page.
 * Hidden from assistive technology and the Tab order: it is a printing device, not content.
 */
function createPrintFrame(page: Document): HTMLIFrameElement {
  const frame = page.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.title = 'Print preview';
  Object.assign(frame.style, {
    position: 'fixed',
    top: '0',
    left: '-10000px',
    width: '210mm',
    height: '297mm',
    border: '0',
  });
  frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>';
  return frame;
}

/**
 * CSS Modules put the app's styles in the page's head (`<style>` in development, `<link>` in a
 * build), and the frame does not inherit them. They are copied across, followed by the print
 * stylesheet, and printing waits until they and the fonts have loaded.
 */
async function copyStyles(from: Document, to: Document): Promise<void> {
  const loading: Promise<unknown>[] = [];
  for (const node of from.head.querySelectorAll('style, link[rel="stylesheet"]')) {
    if (node instanceof HTMLLinkElement) {
      const link = to.createElement('link');
      link.rel = 'stylesheet';
      link.href = node.href; // The resolved URL, since the frame's base URL may differ.
      if (node.crossOrigin !== null) link.crossOrigin = node.crossOrigin;
      loading.push(
        new Promise((resolve) => {
          link.addEventListener('load', resolve, { once: true });
          link.addEventListener('error', resolve, { once: true });
        }),
      );
      to.head.append(link);
    } else {
      to.head.append(to.importNode(node, true));
    }
  }
  const print = to.createElement('style');
  print.textContent = printStyles;
  to.head.append(print);

  await withTimeout(Promise.all(loading));
  // `fonts` is missing in jsdom, though the DOM types promise it.
  if ('fonts' in to) await withTimeout(to.fonts.ready);
}

function withTimeout(promise: Promise<unknown>): Promise<unknown> {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(resolve, STYLES_TIMEOUT_MS);
    }),
  ]);
}
