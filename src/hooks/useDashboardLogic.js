import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { playAudio } from '../utils/audio.js';

export function useDashboardLogic({
  userId,
  roomId,
  partnerId,
  partnerProfile,
  updateSyncStateAtomic,
  mergeSyncState,
  sfxEnabled,
  toast,
  setShowKiss,
  syncBroadcast,
  coupleData,
  globalState,
  isInitialized,
  user
}) {
  const [dbStats, setDbStats] = useState({});
  const [partnerWeather, setPartnerWeather] = useState(null);
  const [unviewedDoodle, setUnviewedDoodle] = useState(null);
  const [petCooldown, setPetCooldown] = useState(false);
  const [petAction, setPetAction] = useState(null);
  const [lastActionTime, setLastActionTime] = useState(0);

  // Track daily login streaks
  useEffect(() => {
    if (!isInitialized || !userId || !globalState) return;

    const streaks = globalState.user_streaks?.[userId];
    const today = new Date().toLocaleDateString('en-CA');
    const lastLogin = streaks?.lastLogin;

    if (lastLogin === today) {
      return;
    }

    let newCount = 1;
    const currentBest = streaks?.best || 0;

    if (lastLogin) {
      const todayDate = new Date();
      const yesterdayDate = new Date(todayDate);
      yesterdayDate.setDate(todayDate.getDate() - 1);
      const yesterday = yesterdayDate.toLocaleDateString('en-CA');

      if (lastLogin === yesterday) {
        newCount = (streaks.count || 0) + 1;
      }
    }

    const newBest = Math.max(currentBest, newCount);

    updateSyncStateAtomic('user_streaks', userId, {
      count: newCount,
      best: newBest,
      lastLogin: today
    });
  }, [isInitialized, userId, globalState, updateSyncStateAtomic]);

  // Fetch Stats
  useEffect(() => {
    if (!roomId || !userId) return;
    const fetchStats = async () => {
      const { data, error } = await supabase
        .from('room_player_stats')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', userId);
      
      if (!error && data) {
        const statsMap = {};
        data.forEach(row => {
          statsMap[row.game_name] = row;
        });
        setDbStats(statsMap);
      }
    };
    fetchStats();
  }, [roomId, userId]);

  // Geolocation
  useEffect(() => {
    if (!userId || !roomId) return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      try {
        const cacheKey = `geo_${lat.toFixed(2)}_${lon.toFixed(2)}`;
        const cachedGeo = localStorage.getItem(cacheKey);
        let city = 'Unknown';
        if (cachedGeo) {
          city = cachedGeo;
        } else {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { 'Accept-Language': 'en', 'User-Agent': 'YardArcade/1.0 (contact@yardarcade.internal)' } }
          );
          const geo = await res.json();
          city = geo?.address?.city || geo?.address?.town || geo?.address?.village || geo?.address?.county || 'Unknown';
          localStorage.setItem(cacheKey, city);
        }
        updateSyncStateAtomic('room_profiles', userId, { location: { lat, lon, city } });
      } catch (e) {
        console.warn('[GEO] Reverse geocode failed:', e.message);
      }
    }, () => {});
  }, [userId, roomId, updateSyncStateAtomic]);

  // Partner Weather
  useEffect(() => {
    const loc = partnerProfile?.location;
    if (!loc?.lat || !loc?.lon) return;
    let cancelled = false;
    const WMO_EMOJI = {
      0: '☀️', 1: '🌤', 2: '⛅', 3: '☁️',
      45: '🌫', 48: '🌫',
      51: '🌦', 53: '🌦', 55: '🌧',
      61: '🌧', 63: '🌧', 65: '🌧',
      71: '🌨', 73: '🌨', 75: '❄️',
      80: '🌦', 81: '🌧', 82: '⛈',
      95: '⛈', 96: '⛈', 99: '⛈',
    };

    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current_weather=true&temperature_unit=celsius`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const cw = data?.current_weather;
        if (cw) {
          const emoji = WMO_EMOJI[cw.weathercode] ?? '🌡';
          setPartnerWeather({ temp: Math.round(cw.temperature), emoji, city: loc.city });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [partnerProfile?.location]);

  // Fetch Doodles
  useEffect(() => {
    if (!roomId || !partnerId) return;
    const fetchDoodles = async () => {
      const { data, error } = await supabase
        .from('shared_assets')
        .select('*')
        .eq('room_id', roomId)
        .eq('type', 'doodle')
        .eq('owner_id', partnerId)
        .order('created_at', { ascending: false });
      
      if (error || !data) return;
      
      const seenAssets = JSON.parse(localStorage.getItem('seen_assets') || '[]');
      const newDoodles = data.filter(a => !seenAssets.includes(a.id));
      if (newDoodles.length > 0) setUnviewedDoodle(newDoodles[0]);
    };
    fetchDoodles();
  }, [roomId, partnerId]);

  // Pet Actions
  const handleFeed = () => {
    if (petCooldown) return;
    playAudio('click', sfxEnabled);
    mergeSyncState('couple_data', { petHappy: Math.min(100, (coupleData.petHappy || 60) + 20) });
    toast('Fed the pet!', 'success', 1500);
    setPetAction('eat');
    setTimeout(() => setPetAction(null), 3000);
    setPetCooldown(true);
    setTimeout(() => setPetCooldown(false), 2000);
  };

  const handlePet = () => {
    if (petCooldown) return;
    playAudio('click', sfxEnabled);
    mergeSyncState('couple_data', { petHappy: Math.min(100, (coupleData.petHappy || 60) + 10) });
    toast('Petted the pet!', 'success', 1200);
    setPetCooldown(true);
    setTimeout(() => setPetCooldown(false), 2000);
  };

  const handleHit = () => {
    if (petCooldown) return;
    playAudio('click', sfxEnabled);
    mergeSyncState('couple_data', { petHappy: Math.max(0, (coupleData.petHappy || 60) - 5) });
    toast('Ouch... that was a hit.', 'warning', 1400);
    setPetCooldown(true);
    setTimeout(() => setPetCooldown(false), 2000);
  };

  const handleSendKiss = () => {
    if (Date.now() - lastActionTime < 3000) return;
    setLastActionTime(Date.now());
    playAudio('click', sfxEnabled);
    syncBroadcast('interaction', { type: 'kiss', from: userId, timestamp: Date.now().toString() });
    mergeSyncState('couple_data', { lastKissFrom: userId, lastKissTimestamp: Date.now().toString() });
  };

  return {
    dbStats,
    partnerWeather,
    unviewedDoodle,
    petCooldown,
    petAction,
    lastActionTime,
    handleFeed,
    handlePet,
    handleHit,
    handleSendKiss,
    setUnviewedDoodle
  };
}
