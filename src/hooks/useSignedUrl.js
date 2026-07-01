import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const urlCache = {};

export function useSignedUrl(bucket, path, expires = 3600) {
  const [signedUrl, setSignedUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!path) return;

    // Check cache
    const cacheKey = `${bucket}:${path}`;
    if (urlCache[cacheKey] && urlCache[cacheKey].expiresAt > Date.now() + 60000) {
      setSignedUrl(urlCache[cacheKey].url);
      return;
    }

    let isMounted = true;
    const fetchSignedUrl = async () => {
      setLoading(true);
      try {
        const { data, error: err } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, expires);

        if (err) throw err;

        if (isMounted) {
          setSignedUrl(data.signedUrl);
          urlCache[cacheKey] = {
            url: data.signedUrl,
            expiresAt: Date.now() + expires * 1000
          };
        }
      } catch (err) {
        console.error('Error creating signed URL:', err);
        if (isMounted) setError(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSignedUrl();

    return () => { isMounted = false; };
  }, [bucket, path, expires]);

  return { signedUrl, loading, error };
}

/**
 * Helper to parse a Supabase public URL into bucket and path
 */
export function parseSupabaseUrl(url) {
  if (!url || typeof url !== 'string') return { bucket: null, path: null };
  
  // Example: https://xyz.supabase.co/storage/v1/object/public/bucket/path/to/file.png
  // Or: bucket/path/to/file.png
  
  try {
    if (url.startsWith('http')) {
      const parts = url.split('/storage/v1/object/public/');
      if (parts.length < 2) {
         // Try authenticated path if any
         const authParts = url.split('/storage/v1/object/authenticated/');
         if (authParts.length >= 2) {
             const [bucket, ...pathParts] = authParts[1].split('/');
             return { bucket, path: pathParts.join('/') };
         }
         return { bucket: null, path: null };
      }
      const [bucket, ...pathParts] = parts[1].split('/');
      return { bucket, path: pathParts.join('/') };
    } else {
      // Assume it's already bucket/path format
      const [bucket, ...pathParts] = url.split('/');
      return { bucket, path: pathParts.join('/') };
    }
  } catch (e) {
    return { bucket: null, path: null };
  }
}
