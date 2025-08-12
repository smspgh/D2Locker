import { d2lNeedsUpdate$, reloadD2L } from 'app/register-service-worker';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

/**
 * "Sneaky Updates" - reload on navigation if D2L needs an update.
 */
export default function SneakyUpdates() {
  const { pathname } = useLocation();
  const initialLoad = useRef(true);
  useEffect(() => {
    if (!initialLoad.current && d2lNeedsUpdate$.getCurrentValue()) {
      reloadD2L();
    }
    initialLoad.current = false;
  }, [pathname]);

  return null;
}
