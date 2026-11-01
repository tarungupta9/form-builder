import { useCallback, useEffect, useState } from 'react';

/**
 * Moves focus to an element by ID once the next render has put it on the page, such as a field
 * that has only just been added. Each request is a new object, so asking for the same element
 * twice still moves focus the second time.
 */
export function useFocusRequest(): (elementId: string) => void {
  const [request, setRequest] = useState<{ elementId: string } | null>(null);

  useEffect(() => {
    if (request) document.getElementById(request.elementId)?.focus();
  }, [request]);

  return useCallback((elementId: string) => {
    setRequest({ elementId });
  }, []);
}
