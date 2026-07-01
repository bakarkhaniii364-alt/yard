/**
 * webrtc.js — ICE & TURN Utilities for Yard
 */

/**
 * Returns static fallbacks if dynamic fetching fails.
 */
export function getStaticIceServers() {
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: [
        'turns:relay.metered.ca:443?transport=tcp',
        'turn:relay.metered.ca:3478?transport=udp'
      ],
      username: '7b7a36e720529076fafd84b7',
      credential: 'londsjncTUuBxGCU'
    },
    { urls: "turn:numb.viagenie.ca", username: "webrtc@live.com", credential: "muazkh" },
    { urls: "turn:turn.anyfirewall.com:443?transport=tcp", username: "webrtc", credential: "webrtc" },
    { urls: "turn:turn.freeswitch.org", username: "freeswitch", credential: "freeswitch" }
  ];
}

import { isTestMode } from '../lib/testMode.js';

/**
 * Fetches fresh TURN credentials from Cloudflare if configured.
 */
export async function getFullIceServers() {
  if (isTestMode()) {
    return getStaticIceServers();
  }

  const WORKER_URL = 'https://yard-turn-creds.damiyanw96.workers.dev/ice-servers';
  
  let cfServers = [];
  try {
    console.log('[WebRTC] Fetching fresh ICE servers from secure worker...');
    const resp = await fetch(WORKER_URL);
    const data = await resp.json();
    
    // Support both direct array and wrapped object formats
    if (Array.isArray(data)) {
      cfServers = data;
    } else if (data.iceServers) {
      cfServers = data.iceServers;
    }
    
    if (cfServers.length > 0) {
      console.log('[WebRTC] Secure ICE servers acquired.');
    }
  } catch (e) {
    console.warn('[WebRTC] Secure ICE fetch failed, using fallbacks:', e.message);
  }

  return [...cfServers, ...getStaticIceServers()];
}
