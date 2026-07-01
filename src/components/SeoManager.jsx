import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applySeo, getSeoForPath } from '../lib/seo.js';

/**
 * Updates document title and meta tags on client-side route changes.
 */
export function SeoManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const config = getSeoForPath(pathname);
    applySeo({ ...config, path: pathname });
  }, [pathname]);

  return null;
}
