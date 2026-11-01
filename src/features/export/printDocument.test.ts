import { newResponseId, toIsoDateTime } from '../../domain/ids';
import type { ExportDocument } from './exportModel';
import { pdfFileName } from './exportModel';
import { printDocument } from './printDocument';

/*
 * jsdom has frames but cannot print or focus a window, so each test stands in for the
 * browser's print dialog by replacing `print` (and `focus`) on the frame's window. What jsdom
 * cannot show (the PDF itself, page numbers, the Save dialog's file name) is checked by hand
 * in the demo script.
 */
const contentWindowDescriptor = Object.getOwnPropertyDescriptor(
  HTMLIFrameElement.prototype,
  'contentWindow',
)!;

function stubFramePrint(print: (this: Window) => void) {
  vi.spyOn(HTMLIFrameElement.prototype, 'contentWindow', 'get').mockImplementation(function (
    this: HTMLIFrameElement,
  ) {
    const frameWindow = contentWindowDescriptor.get!.call(this) as Window | null;
    // As in a browser, focusing the frame's window makes the frame the page's active element.
    const focusFrame = () => {
      this.focus();
    };
    if (frameWindow) Object.assign(frameWindow, { print, focus: focusFrame });
    return frameWindow;
  });
}

/** A browser that fires `afterprint` once the dialog closes, as Chrome and Safari do. */
const printAndClose = (inspect: (frameWindow: Window) => void = () => undefined) =>
  function (this: Window) {
    inspect(this);
    this.dispatchEvent(new Event('afterprint'));
  };

const exportDocument: ExportDocument = {
  title: 'Expense claim',
  description: '',
  responseId: newResponseId(),
  submittedAt: toIsoDateTime(new Date(2026, 10, 1, 9, 5)),
  blocks: [{ kind: 'answer', label: 'Employee name', value: { kind: 'text', text: 'Ada' } }],
};

const frames = () => document.querySelectorAll('iframe');

// printDocument renders into its own React root, as in the browser. Testing Library marks every
// test file as an `act` environment, which would flag that render; this file renders nothing
// through Testing Library, so the flag is lifted here only.
const reactGlobals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
let actEnvironment: boolean | undefined;
beforeAll(() => {
  actEnvironment = reactGlobals.IS_REACT_ACT_ENVIRONMENT;
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = false;
});
afterAll(() => {
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = actEnvironment;
});

describe('printDocument', () => {
  beforeEach(() => {
    document.title = 'Responses: Expense claim – Form builder';
  });

  it('mounts the document’s text in a frame and removes the frame after printing', async () => {
    let printed = '';
    stubFramePrint(
      printAndClose((frameWindow) => {
        printed = frameWindow.document.body.textContent;
      }),
    );

    await printDocument(exportDocument);

    expect(printed).toContain('Expense claim');
    expect(printed).toContain('Employee name');
    expect(printed).toContain('Ada');
    expect(frames()).toHaveLength(0);
  });

  it('hides the frame from assistive technology and the Tab order', async () => {
    let frame: HTMLIFrameElement | undefined;
    stubFramePrint(
      printAndClose(() => {
        frame = frames()[0];
      }),
    );

    await printDocument(exportDocument);

    expect(frame).toHaveAttribute('aria-hidden', 'true');
    expect(frame).toHaveAttribute('tabindex', '-1');
  });

  it('names the file after the response while printing, then restores the page title', async () => {
    const titles: string[] = [];
    stubFramePrint(
      printAndClose((frameWindow) => {
        titles.push(document.title, frameWindow.document.title);
      }),
    );

    await printDocument(exportDocument);

    const fileName = pdfFileName(exportDocument);
    expect(titles).toEqual([fileName, fileName]);
    expect(document.title).toBe('Responses: Expense claim – Form builder');
  });

  it('copies the page’s styles into the frame, so the document looks the same', async () => {
    const style = document.createElement('style');
    style.textContent = '.probe-rule { color: red; }';
    document.head.append(style);
    let frameStyles = '';
    stubFramePrint(
      printAndClose((frameWindow) => {
        frameStyles = frameWindow.document.head.innerHTML;
      }),
    );

    await printDocument(exportDocument);
    style.remove();

    expect(frameStyles).toContain('.probe-rule');
  });

  it('returns focus to the control that started it, after focusing the frame to print', async () => {
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    stubFramePrint(printAndClose());

    await printDocument(exportDocument);

    expect(button).toHaveFocus();
    button.remove();
  });

  it('keeps the frame until the browser says printing is over, so a slow dialog never prints a blank page', async () => {
    // A browser whose print() returns at once, before the respondent has saved anything.
    stubFramePrint(() => undefined);

    await printDocument(exportDocument);

    expect(frames()).toHaveLength(1);
    expect(document.title).toBe('Responses: Expense claim – Form builder');
    frames()[0]!.contentWindow!.dispatchEvent(new Event('afterprint'));
    expect(frames()).toHaveLength(0);
  });

  it('rejects, leaving nothing behind, when the frame has no window', async () => {
    vi.spyOn(HTMLIFrameElement.prototype, 'contentWindow', 'get').mockReturnValue(null);

    await expect(printDocument(exportDocument)).rejects.toThrow();

    expect(frames()).toHaveLength(0);
    expect(document.title).toBe('Responses: Expense claim – Form builder');
  });

  it('rejects, leaving nothing behind, when the browser refuses to print', async () => {
    stubFramePrint(() => {
      throw new DOMException('Printing is blocked', 'NotAllowedError');
    });

    await expect(printDocument(exportDocument)).rejects.toThrow('Printing is blocked');

    expect(frames()).toHaveLength(0);
    expect(document.title).toBe('Responses: Expense claim – Form builder');
  });
});
