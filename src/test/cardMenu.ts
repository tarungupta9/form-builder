import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

type CardAction = 'Open in builder' | 'View responses' | 'Delete';

/** The "More actions" button on a template card on the home page (ADR 0020). */
export const cardMenuButton = (title: string) =>
  screen.findByRole('button', { name: `More actions for ${title}` });

/** Opens a template card's menu and chooses one of its actions, as a user would. */
export async function chooseCardAction(user: UserEvent, title: string, action: CardAction) {
  await user.click(await cardMenuButton(title));
  const menu = within(screen.getByRole('menu', { name: `More actions for ${title}` }));
  await user.click(menu.getByRole('menuitem', { name: action }));
}
