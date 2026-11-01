import { Link } from 'react-router';
import { PageHeader } from '../ui/PageHeader';
import { usePageTitle } from './usePageTitle';

/** For unknown URLs, and for links to a template that does not exist (or no longer does). */
export function NotFound() {
  usePageTitle('Page not found');
  return (
    <>
      <PageHeader title="Page not found" />
      <p>
        There is nothing at this address. The template may have been deleted, or the link may be
        mistyped. <Link to="/">Go to your templates</Link>
      </p>
    </>
  );
}
