import { useRef } from 'react';
import { useGlobalSync } from './useSupabaseSync.js';

export function useTypingIndicator(userId, partnerId) {
  const [myTyping, setMyTyping] = useGlobalSync(`typing_${userId}`, false);
  const [partnerTyping] = useGlobalSync(`typing_${partnerId}`, false);
  const typingTimeoutRef = useRef(null);

  const handleTyping = () => {
    if (!myTyping) {
      setMyTyping(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setMyTyping(false);
    }, 1500);
  };

  const stopTyping = () => {
    setMyTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  return {
    isTypingLocal: myTyping,
    isPartnerTyping: !!partnerTyping,
    handleTyping,
    stopTyping
  };
}
