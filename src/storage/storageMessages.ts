import { assertNever } from '../domain/assertNever';
import type { StorageError } from './result';

/** What to tell the user when storage fails, in plain words, with what happened to their data. */
export function describeStorageError(error: StorageError): { title: string; body: string } {
  switch (error.kind) {
    case 'unavailable':
      return {
        title: 'This browser is not letting the app save',
        body: 'Storage is turned off, perhaps by a private window or a privacy setting. Allow site data for this page and reload.',
      };
    case 'quota':
      return {
        title: 'Storage is full',
        body: 'Nothing was saved, and your changes are still on screen. Delete old responses or templates to make room, then try again.',
      };
    case 'corrupt':
      return {
        title: 'Your saved data could not be read',
        body: error.backupKey
          ? 'The data stored in this browser is not in a format this app recognises. A backup copy was kept before anything changed, and nothing was deleted.'
          : 'The data stored in this browser is not in a format this app recognises, and a backup copy could not be made. Nothing was deleted.',
      };
    case 'newerVersion':
      return {
        title: 'This data was saved by a newer version of the app',
        body: 'To avoid losing anything, this version will not change it. Open the app in the browser tab that is up to date.',
      };
    default:
      return assertNever(error);
  }
}
