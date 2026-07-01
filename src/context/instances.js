import { createContext, useContext } from 'react';

/**
 * Shared Context Instances & Hooks
 * 
 * Centralizing these in a dependency-free leaf file prevents "ReferenceError: Cannot access before initialization"
 * which occurs when context providers or their consumer hooks import each other.
 */

export const AuthContext = createContext(null);
export const SyncContext = createContext(null);
export const CallContext = createContext(null);
export const ChatContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) throw new Error('useSync must be used within a SyncProvider');
  return context;
}

export function useCall() {
  const context = useContext(CallContext);
  if (context === undefined) throw new Error('useCall must be used within a CallProvider');
  return context;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) throw new Error('useChat must be used within a ChatProvider');
  return context;
}
