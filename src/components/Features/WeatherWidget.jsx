import React, { useEffect } from 'react';
import { useGlobalSync } from '../../hooks/useSupabaseSync.js';

export function WeatherWidget({ compact = false, userId, partnerId }) {
  const [broadcasts, setBroadcasts] = useGlobalSync('weather_broadcasts', {});
  
  useEffect(() => {
    if (!userId) return;

    const fetchAndBroadcast = async () => {
      try {
        const res = await fetch('https://wttr.in/?format=j1');
        if (!res.ok) throw new Error('Weather fetch failed');
        const data = await res.json();
        
        const simplified = {
          temp: data.current_condition[0].temp_C,
          desc: data.current_condition[0].weatherDesc[0].value,
          city: data.nearest_area[0].areaName[0].value,
          timestamp: Date.now()
        };

        setBroadcasts(prev => ({
          ...(prev || {}),
          [userId]: simplified
        }));
      } catch (err) {
        console.warn("Weather broadcast failed:", err);
      }
    };

    fetchAndBroadcast();
    const interval = setInterval(fetchAndBroadcast, 1800000);
    return () => clearInterval(interval);
  }, [userId, setBroadcasts]);

  const partnerWeather = partnerId ? (broadcasts || {})[partnerId] : null;
  const isStale = partnerWeather && (Date.now() - partnerWeather.timestamp > 3600000);

  if (!partnerWeather || isStale) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-main-text animate-in fade-in duration-700">
        <div className="w-8 h-8 border-2 border-border bg-accent text-accent-text flex items-center justify-center font-bold text-[10px] shadow-sm">
          {partnerWeather.temp}°C
        </div>
        <div className="flex flex-col">
          <p className="font-bold text-[9px] uppercase leading-none">{partnerWeather.desc}</p>
          <p className="text-[8px] opacity-40 uppercase tracking-tighter leading-none">{partnerWeather.city}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border pt-2 mt-2 text-main-text animate-in fade-in duration-700">
      <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mb-1">🌤️ Partner's Weather</p>
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 border-2 border-border bg-accent text-accent-text flex items-center justify-center font-bold text-xs shadow-sm">
          {partnerWeather.temp}°C
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-xs truncate leading-none mb-1">{partnerWeather.desc}</p>
          <p className="text-[10px] opacity-40 uppercase tracking-tighter">{partnerWeather.city}</p>
        </div>
      </div>
    </div>
  );
}
