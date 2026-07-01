import React from 'react';
import { useMobile } from '../hooks/useMobile';

/**
 * Component that only renders its children on mobile devices (<= 768px)
 */
export const MobileOnly = ({ children }) => {
  const isMobile = useMobile();
  
  if (!isMobile) return null;
  
  return <>{children}</>;
};

/**
 * Component that only renders its children on desktop devices (> 768px)
 */
export const DesktopOnly = ({ children }) => {
  const isMobile = useMobile();
  
  if (isMobile) return null;
  
  return <>{children}</>;
};
