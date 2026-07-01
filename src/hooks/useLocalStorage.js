import { useState, useEffect } from 'react';
import localforage from 'localforage';

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(initialValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const prefix = window.__YARD_STORAGE_PREFIX__ || '';
        const item = await localforage.getItem(prefix + key);
        if (mounted && item !== null) {
          setStoredValue(item);
        }
      } catch (e) {}
      if (mounted) setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, [key]);

  useEffect(() => {
    if (!loading) {
      const prefix = window.__YARD_STORAGE_PREFIX__ || '';
      localforage.setItem(prefix + key, storedValue).catch(e => console.error(e));
    }
  }, [key, storedValue, loading]);

  const setValue = (value) => {
    setStoredValue((prevValue) => {
      const valueToStore = value instanceof Function ? value(prevValue) : value;
      return valueToStore;
    });
  };

  return [storedValue, setValue, loading];
}
