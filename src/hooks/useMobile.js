import { useState, useEffect } from 'react';

/**
 * Hook to detect if the viewport is in mobile range (<= 768px)
 */
export const useMobile = () => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handler);
    // Initial check
    handler();

    return () => window.removeEventListener('resize', handler);
  }, []);

  return isMobile;
};
