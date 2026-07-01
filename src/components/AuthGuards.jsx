import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/instances.js';
import { BootLoader } from './BootLoader.jsx';

/**
 * ProtectedRoute - Ensures user is logged in.
 * By default, it also ensures the user has a paired room.
 */
export function ProtectedRoute({ children, requireRoom = false }) {
  const { user, hasInitialized } = useAuth();
  const location = useLocation();

  // Show the boot loader if auth session is not initialized
  if (!hasInitialized) {
    return <BootLoader onComplete={() => {}} />;
  }

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
}

export function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <BootLoader onComplete={() => {}} />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
