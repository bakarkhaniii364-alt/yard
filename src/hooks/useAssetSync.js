import { useState, useEffect, useCallback, useRef } from 'react';
import localforage from 'localforage';
import { supabase } from '../lib/supabase.js';

/**
 * useAssetSync - Specialized hook for room assets (Doodles, Images)
 * Fetches assets from shared_assets table and handles storage uploads.
 */
export function useAssetSync(roomId, assetType = null, userId = null) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  const assetsRef = useRef([]);
  assetsRef.current = assets;

  // 1. Fetch Assets
  useEffect(() => {
    if (!roomId) return;

    let mounted = true;

    const fetchAssets = async () => {
      let query = supabase
        .from('shared_assets')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false });

      if (assetType) {
        query = query.eq('type', assetType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[ASSETS] Fetch error:', error);
        if (mounted) setLoading(false);
        return;
      }

      if (mounted) {
        setAssets(data || []);
        setLoading(false);
      }
    };

    fetchAssets();

    // 2. Realtime Updates (Appended a random string to guarantee a unique channel per mount)
    const uniqueId = Math.random().toString(36).substring(7);
    const channelName = `room_assets_${roomId}_${assetType || 'all'}_${uniqueId}`;
    const channel = supabase.channel(channelName);
    channel
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'shared_assets', 
          filter: `room_id=eq.${roomId}` 
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Only add if it matches our filtered type (or if we are listening to all)
            if (!assetType || payload.new.type === assetType) {
              setAssets(prev => [payload.new, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            setAssets(prev => prev.map(a => a.id === payload.new.id ? payload.new : a));
          } else if (payload.eventType === 'DELETE') {
            setAssets(prev => prev.filter(a => a.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [roomId, assetType]);

  // 3. Upload & Save Asset
  const uploadAsset = useCallback(async (fileBlob, type, ownerId, metadata = {}) => {
    if (!roomId) return;

    // A. Upload to Supabase Storage
    const fileExt = fileBlob.type.split('/')[1] || 'png';
    const fileName = `${roomId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const bucket = type === 'doodle' ? 'doodles' : 'scrapbook';

    const { data: storageData, error: storageError } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileBlob, { cacheControl: '3600', upsert: true });

    if (storageError) {
      console.error('[ASSETS] Storage upload error:', storageError);
      throw storageError;
    }

    // B. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    // C. Save to shared_assets table
    const { data: assetData, error: assetError } = await supabase
      .from('shared_assets')
      .insert({
        room_id: roomId,
        owner_id: ownerId,
        type,
        url: publicUrl,
        metadata
      })
      .select()
      .single();

    return assetData;
  }, [roomId]);

  const deleteAsset = useCallback(async (id) => {
    if (!id) return;
    try {
      await supabase.from('shared_assets').delete().eq('id', id);
    } catch(e) { console.error('Failed to delete asset', e); }
  }, []);

  const markAssetRead = useCallback(async (id) => {
    if (!id || !userId) return;
    try {
      const asset = assetsRef.current.find(a => a.id === id);
      if (!asset) return;
      
      const metadata = asset.metadata || {};
      const readBy = Array.isArray(metadata.read_by) ? metadata.read_by : [];
      
      if (!readBy.includes(userId)) {
        const newMetadata = { ...metadata, read_by: [...readBy, userId] };
        await supabase.from('shared_assets').update({ metadata: newMetadata }).eq('id', id);
        setAssets(prev => prev.map(a => a.id === id ? { ...a, metadata: newMetadata } : a));
      }
    } catch(e) { console.error('Failed to mark read', e); }
  }, [userId]);

  return { assets, uploadAsset, deleteAsset, markAssetRead, loading };
}
