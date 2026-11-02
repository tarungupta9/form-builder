/**
 * jsdom lays nothing out: every element measures 0 × 0 at the origin, so dnd-kit's keyboard
 * sensor finds no item above or below the one it holds, and an arrow key moves nothing. This
 * gives each list item a 40 px tall box, one per 50 px down the page by its position in its
 * list, and gives everything inside the item the item's box. That is enough for a keyboard drag
 * to pick the right neighbour. Pointer drags are still checked by hand in a browser.
 *
 * `restoreMocks` in the Vitest config undoes the stub after each test.
 */
export function stubListLayout(): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const item = this.closest('li');
    const index = item?.parentElement ? [...item.parentElement.children].indexOf(item) : 0;
    return new DOMRect(0, index * 50, 300, item ? 40 : 0);
  });
}
