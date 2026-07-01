/**
 * CallContext.jsx — Native WebRTC, zero PeerJS dependency.
 *
 * Signaling over Supabase broadcast (room_call_${roomId}):
 *   ring      → caller announces
 *   accepted  → receiver accepted, trigger offer
 *   offer     → caller's SDP offer
 *   answer    → receiver's SDP answer
 *   ice       → trickle ICE candidates (both sides)
 *   ended     → hang-up
 *   busy      → receiver already in call
 *
 * Timer starts on ICE 'connected' state (not before).
 * Remote audio is wired directly via a ref in CallOverlay.
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from './instances.js';
import { isTestMode, sendTestBroadcast, onTestBroadcast } from '../lib/testMode.js';
import { getFullIceServers, getStaticIceServers } from '../utils/webrtc.js';
import { CallContext } from './instances.js';

// ── Ringing tone (Web Audio) ─────────────────────────────────────────────────
function createRingTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let interval;
    const ring = () => {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
      o1.frequency.value = 480; o2.frequency.value = 620;
      o1.connect(g); o2.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.setValueAtTime(0, ctx.currentTime + 1);
      o1.start(); o2.start(); o1.stop(ctx.currentTime + 1); o2.stop(ctx.currentTime + 1);
    };
    ring();
    interval = setInterval(ring, 3000);
    return () => { clearInterval(interval); try { ctx.close(); } catch (_) {} };
  } catch (_) { return () => {}; }
}

export function CallProvider({ children }) {
  const { userId, partnerId, roomId } = useAuth();

  useEffect(() => {
    const u = import.meta.env.VITE_TURN_USERNAME;
    const p = import.meta.env.VITE_TURN_PASSWORD;
    if (!u || !p || u === 'openrelayproject' || p === 'openrelayproject') {
      console.warn('[WebRTC] TURN credentials appear missing or default.');
    }
  }, []);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [calling,       setCalling]       = useState(null);   // 'audio'|'video'|null
  const [isRinging,     setIsRinging]     = useState(false);
  const [incomingCall,  setIncomingCall]  = useState(null);
  const [callDuration,  setCallDuration]  = useState(0);
  const [remoteStream,  setRemoteStream]  = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [localStream,   setLocalStream]   = useState(null);
  const [isMuted,       setIsMuted]       = useState(false);
  const [isDeafened,    setIsDeafened]    = useState(false);
  const [isCameraOff,   setIsCameraOff]   = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [isPartnerScreenSharing, setIsPartnerScreenSharing] = useState(false);
  const [noiseSuppression, setNoiseSuppression] = useState(() => localStorage.getItem('call_noise_suppression') !== 'false');
  const [echoCancellation, setEchoCancellation] = useState(() => localStorage.getItem('call_echo_cancellation') !== 'false');
  const [callStatus,    setCallStatus]    = useState('idle');
  const [callQuality,   setCallQuality]   = useState('good');
  const [partnerInCall, setPartnerInCall] = useState(false);
  const [isPartnerCameraOff, setIsPartnerCameraOff] = useState(false);

  useEffect(() => {
    localStorage.setItem('call_noise_suppression', noiseSuppression);
    localStorage.setItem('call_echo_cancellation', echoCancellation);
  }, [noiseSuppression, echoCancellation]);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const pcRef              = useRef(null);  // RTCPeerConnection
  const dcRef              = useRef(null);  // RTCDataChannel (game/doodle P2P)
  const localStreamRef     = useRef(null);
  const screenTrackRef     = useRef(null);
  const callChannelRef     = useRef(null);
  const channelReadyRef    = useRef(false);
  const signalQueueRef     = useRef([]);
  const callTimerRef       = useRef(null);
  const qualityTimerRef    = useRef(null);
  const ringRetryRef       = useRef(null);
  const ringTimeoutRef     = useRef(null);
  const ringStopRef        = useRef(null);
  const callStatusRef      = useRef('idle');
  const callDurationRef    = useRef(0);
  const pendingCandidates  = useRef([]);   // ICE queue before remote desc is set
  const isCallerRef        = useRef(false);
  const callTypeRef        = useRef(null);
  const isRingingRef       = useRef(false);
  const callingRef         = useRef(null);
  const makingOfferRef     = useRef(false); // glare prevention
  const remoteTracksRef    = useRef([]);
  const partnerScreenTrackIdRef = useRef(null);
  const partnerScreenStreamIdRef = useRef(null);

  useEffect(() => { callingRef.current  = calling;  }, [calling]);
  useEffect(() => { isRingingRef.current = isRinging; }, [isRinging]);
  useEffect(() => { callStatusRef.current = callStatus; }, [callStatus]);
  useEffect(() => { callDurationRef.current = callDuration; }, [callDuration]);

  // ── Timer: starts exactly when ICE connects ───────────────────────────────
  useEffect(() => {
    if (callStatus === 'connected') {
      setCallDuration(1);
      callDurationRef.current = 1;
      callTimerRef.current = setInterval(() => setCallDuration(d => {
        const next = d + 1;
        callDurationRef.current = next;
        return next;
      }), 1000);
    } else {
      if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    }
    return () => { if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; } };
  }, [callStatus]);

  // Test Mode Auto-Connect logic removed to allow real WebRTC signaling to finish and trigger ICE connected state naturally

  // ── updateRemoteStreams ───────────────────────────────────────────────────
  const updateRemoteStreams = useCallback(() => {
    const tracks = remoteTracksRef.current;
    console.log('[Call] updateRemoteStreams: active remote tracks =', tracks.map(t => `${t.kind}:${t.id}:${t.readyState}`));
    
    const audioTracks = tracks.filter(t => t.kind === 'audio' && t.readyState === 'live');
    const videoTracks = tracks.filter(t => t.kind === 'video' && t.readyState === 'live');
    
    const screenTrack = videoTracks.find(t => t.id === partnerScreenTrackIdRef.current);
    const cameraTracks = videoTracks.filter(t => t.id !== partnerScreenTrackIdRef.current);

    console.log('[Call] updateRemoteStreams: screenTrack =', screenTrack?.id, 'cameraTracks =', cameraTracks.map(t => t.id));

    if (audioTracks.length > 0 || cameraTracks.length > 0) {
      setRemoteStream(new MediaStream([...audioTracks, ...cameraTracks]));
    } else {
      setRemoteStream(null);
    }

    if (screenTrack) {
      setRemoteScreenStream(new MediaStream([screenTrack]));
    } else {
      setRemoteScreenStream(null);
    }
  }, []);

  // ── cleanupCall ───────────────────────────────────────────────────────────
  const cleanupCall = useCallback(() => {
    console.log('[Call] Cleaning up all call state and stopping tracks...');
    [callTimerRef, qualityTimerRef, ringRetryRef, ringTimeoutRef].forEach(r => {
      if (r.current) { clearInterval(r.current); clearTimeout(r.current); r.current = null; }
    });
    if (ringStopRef.current)  { ringStopRef.current(); ringStopRef.current = null; }
    if (screenTrackRef.current) { try { screenTrackRef.current.stop(); } catch(_){} screenTrackRef.current = null; }
    
    // Exhaustive track stopping
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => {
        console.log(`[Call] Stopping local track: ${t.kind}`);
        t.stop();
      });
      localStreamRef.current = null;
    }
    if (dcRef.current) {
      try { dcRef.current.close(); } catch (_) {}
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.getSenders().forEach(s => { if (s.track) s.track.stop(); });
      try { pcRef.current.close(); } catch(_){}
      pcRef.current = null;
    }
    pendingCandidates.current = [];
    makingOfferRef.current = false;
    isCallerRef.current = false;
    remoteTracksRef.current = [];
    partnerScreenTrackIdRef.current = null;
    partnerScreenStreamIdRef.current = null;

    setCalling(null); setIsRinging(false); setIncomingCall(null);
    setRemoteStream(null); setRemoteScreenStream(null); setLocalStream(null); setLocalScreenStream(null); setCallDuration(0);
    setIsMuted(false); setIsCameraOff(false); setIsScreenSharing(false);
    setIsPartnerCameraOff(false); setIsPartnerScreenSharing(false);
    setCallStatus('idle'); setCallQuality('good');
  }, []);

  // ── sendSignal (with queue for pre-subscription signals) ──────────────────
  const sendSignal = useCallback((payload) => {
    const msg = { type: 'broadcast', event: 'call_signal', payload: { ...payload, from: userId } };
    console.log(`[Call] Signaling OUT: ${payload.action}`, payload);
    if (channelReadyRef.current && callChannelRef.current) {
      callChannelRef.current.send(msg);
    } else {
      console.warn(`[Call] Channel not ready, queuing signal: ${payload.action}`);
      signalQueueRef.current.push(msg);
    }
    if (isTestMode()) sendTestBroadcast('call_signal', payload);
  }, [userId]);

  const flushQueue = useCallback(() => {
    const q = signalQueueRef.current.splice(0);
    q.forEach(m => callChannelRef.current?.send(m));
  }, []);

  // ── recordCallEnd / recordMissedCall ─────────────────────────────────────
  const recordCallEnd = useCallback((type, duration) => {
    if (!roomId || !userId) return;
    const m = Math.floor(duration / 60), s = duration % 60;
    supabase.from('chat_messages').insert({
      room_id: roomId, sender_id: userId,
      type: 'call_invite',
      content: `${type === 'video' ? 'Video' : 'Voice'} Call · ${m}:${String(s).padStart(2,'0')}`,
      metadata: { callType: type || 'audio', status: 'ended', duration: `${m}:${String(s).padStart(2,'0')}` },
    }).then(({ error }) => { if (error) console.warn('[Call] End log failed:', error.message); });
  }, [roomId, userId]);

  const recordMissedCall = useCallback((type) => {
    if (!roomId || !userId) return;
    supabase.from('chat_messages').insert({
      room_id: roomId, sender_id: userId,
      type: 'call_invite',
      content: `${type === 'video' ? 'Video' : 'Voice'} Call (Missed)`,
      metadata: { callType: type || 'audio', status: 'missed' },
    }).then(({ error }) => { if (error) console.warn('[Call] Missed log failed:', error.message); });
  }, [roomId, userId]);


  const attachDataChannel = useCallback((channel) => {
    dcRef.current = channel;
    channel.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        window.dispatchEvent(new CustomEvent('webrtc_data', { detail: data }));
      } catch (_) {}
    };
    channel.onclose = () => {
      if (dcRef.current === channel) dcRef.current = null;
    };
  }, []);

  const sendData = useCallback((payload) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') return false;
    try {
      dc.send(JSON.stringify(payload));
      return true;
    } catch (_) {
      return false;
    }
  }, []);

// ── RTCPeerConnection factory ─────────────────────────────────────────────
const createPC = useCallback(async (type) => {
  if (pcRef.current) { try { pcRef.current.close(); } catch(_){} }
  
  const dynamicServers = await getFullIceServers();
  const pc = new RTCPeerConnection({ iceServers: dynamicServers, iceCandidatePoolSize: 10 });
  pcRef.current = pc;

    pc.ondatachannel = (e) => attachDataChannel(e.channel);
    if (isCallerRef.current) {
      attachDataChannel(pc.createDataChannel('yard-data', { ordered: true }));
    }

    // Send our tracks to remote
    if (localStreamRef.current) {
      console.log('[WebRTC] Adding local tracks to PC:', localStreamRef.current.getTracks().map(t => t.kind));
      localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));
    }

    // Receive remote tracks
    pc.ontrack = (e) => {
      console.log('[Call] ontrack — remote track received:', e.track.kind, 'id:', e.track.id);
      
      if (!remoteTracksRef.current.find(t => t.id === e.track.id)) {
        remoteTracksRef.current.push(e.track);
      }
      
      e.track.onended = () => {
        console.log('[Call] Track ended:', e.track.kind, 'id:', e.track.id);
        remoteTracksRef.current = remoteTracksRef.current.filter(t => t.id !== e.track.id);
        updateRemoteStreams();
      };
      
      updateRemoteStreams();
    };

    // Trickle ICE
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const type = e.candidate.candidate.split(' ')[7]; // Simple way to get candidate type
        console.log(`[Call] Local ICE Candidate (${type}):`, e.candidate.candidate);
        sendSignal({ action: 'ice', candidate: e.candidate.toJSON() });
      } else {
        console.log('[Call] ICE Gathering Complete');
      }
    };
    
    pc.onicegatheringstatechange = () => {
      console.log('[Call] ICE Gathering State:', pc.iceGatheringState);
    };

    pc.onconnectionstatechange = () => {
      console.log('[Call] Peer Connection State:', pc.connectionState);
    };

    // ICE state machine
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log('[Call] ICE Connection State:', s);
      if (s === 'connected' || s === 'completed') {
        setCallStatus('connected');
        setCalling(callTypeRef.current);
        setIsRinging(false);
        console.log('[Call] WebRTC Connected Successfully');
        startQualityMonitor(pc);
      } else if (s === 'disconnected') {
        console.warn('[Call] ICE Disconnected - partner might have network issues');
        setCallStatus('reconnecting');
        setTimeout(() => {
          if (pcRef.current?.iceConnectionState === 'disconnected') {
            console.log('[Call] Attempting ICE Restart...');
            try { pcRef.current.restartIce(); } catch(e){ console.error('[Call] Restart ICE failed:', e); }
          }
        }, 2000);
      } else if (s === 'failed') {
        console.error('[Call] ICE Connection Failed. Possible TURN issue or symmetric NAT.');
        setCallStatus('reconnecting');
        if (isCallerRef.current) {
          console.log('[Call] Caller triggering ICE restart due to failure');
          try { pcRef.current?.restartIce(); } catch(e){ console.error('[Call] Restart ICE failed:', e); }
        }
      } else if (s === 'closed') {
        cleanupCall();
      }
    };

    pc.onsignalingstatechange = () => {
      console.log('[Call] Signaling State:', pc.signalingState);
    };

    // Negotiation needed (for re-negotiation e.g. screen share)
    pc.onnegotiationneeded = async () => {
      console.log('[Call] onnegotiationneeded firing. isCaller:', isCallerRef.current, 'signalingState:', pc.signalingState);
      if (makingOfferRef.current) return;
      try {
        makingOfferRef.current = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') {
          console.warn('[Call] Signaling state not stable during negotiation, ignoring offer creation');
          return;
        }
        await pc.setLocalDescription(offer);
        sendSignal({ action: 'offer', sdp: pc.localDescription, callType: callTypeRef.current });
      } catch (e) {
        console.error('[Call] onnegotiationneeded error:', e);
      } finally {
        makingOfferRef.current = false;
      }
    };

    return pc;
  }, [sendSignal, cleanupCall, attachDataChannel, updateRemoteStreams]);

  // ── Quality monitor ───────────────────────────────────────────────────────
  const startQualityMonitor = useCallback((pc) => {
    if (qualityTimerRef.current) clearInterval(qualityTimerRef.current);
    qualityTimerRef.current = setInterval(async () => {
      if (!pc || pc.connectionState === 'closed') return;
      try {
        const stats = await pc.getStats();
        stats.forEach(r => {
          if (r.type === 'inbound-rtp' && r.kind === 'audio' && r.packetsReceived > 0) {
            const loss = (r.packetsLost || 0) / (r.packetsReceived + (r.packetsLost || 0));
            setCallQuality(loss < 0.02 ? 'good' : loss < 0.08 ? 'fair' : 'poor');
          }
        });
      } catch (_) {}
    }, 4000);
  }, []);

  // ── applyPendingCandidates — flush queued ICE candidates ─────────────────
  const applyPendingCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const queue = pendingCandidates.current.splice(0);
    for (const c of queue) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (_) {}
    }
  }, []);

  // ── handleSignal ──────────────────────────────────────────────────────────
  const handleSignal = useCallback(async (payload) => {
    if (!payload || payload.from === userId) return; // ignore own signals
    console.log(`[Call] Signaling IN: ${payload.action}`, payload);

    switch (payload.action) {

      case 'ring': {
        if (callingRef.current) {
          sendSignal({ action: 'busy' });
          return;
        }
        setIncomingCall({ type: payload.callType || 'audio', fromName: payload.fromName });
        setIsRinging(true);
        if (ringStopRef.current) ringStopRef.current();
        ringStopRef.current = createRingTone();
        break;
      }

      case 'busy': {
        cleanupCall();
        window.dispatchEvent(new CustomEvent('call_busy'));
        break;
      }

      case 'accepted': {
        // I am the caller. Receiver accepted → create and send offer.
        if (!isCallerRef.current) return;
        if (ringRetryRef.current) { clearInterval(ringRetryRef.current); ringRetryRef.current = null; }
        if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null; }
        if (ringStopRef.current) { ringStopRef.current(); ringStopRef.current = null; }
        setIsRinging(false);
        setCallStatus('connecting');

        try {
          makingOfferRef.current = true;
          const pc = await createPC(payload.callType);
          const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: payload.callType === 'video' });
          await pc.setLocalDescription(offer);
          sendSignal({ action: 'offer', sdp: pc.localDescription, callType: payload.callType });
        } catch (e) {
          console.error('[Call] offer creation failed:', e);
          sendSignal({ action: 'ended' });
          cleanupCall();
        } finally {
          makingOfferRef.current = false;
        }
        break;
      }

      case 'offer': {
        let pc = pcRef.current;
        if (!pc || pc.connectionState === 'closed') {
          if (isCallerRef.current) return;
          setCallStatus('connecting');
          callTypeRef.current = payload.callType || 'audio';
          try {
            if (!localStreamRef.current) {
              try { if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop()); } catch(_){}
              const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                   echoCancellation,
                   noiseSuppression,
                   autoGainControl: true
                },
                video: payload.callType === 'video',
              });
              localStreamRef.current = stream;
              setLocalStream(stream);
            }
            pc = await createPC(payload.callType);
          } catch (e) {
            console.error('[Call] Failed to acquire media for incoming offer:', e);
            sendSignal({ action: 'ended' });
            cleanupCall();
            alert('Could not access microphone/camera. Please check browser permissions.');
            return;
          }
        } else {
          console.log('[Call] Received renegotiation offer. Reusing existing RTCPeerConnection.');
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await applyPendingCandidates();

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal({ action: 'answer', sdp: pc.localDescription });
        } catch (e) {
          console.error('[Call] offer handling failed:', e);
          if (!pcRef.current || pcRef.current.connectionState === 'closed') {
            sendSignal({ action: 'ended' });
            cleanupCall();
          }
        }
        break;
      }

      case 'answer': {
        const pc = pcRef.current;
        if (!pc || pc.signalingState === 'stable') return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await applyPendingCandidates();
        } catch (e) {
          console.error('[Call] answer handling failed:', e);
        }
        break;
      }

      case 'ice': {
        const pc = pcRef.current;
        if (!payload.candidate) return;
        if (pc && pc.remoteDescription) {
          try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch (_) {}
        } else {
          // Queue until remote description is set
          pendingCandidates.current.push(payload.candidate);
        }
        break;
      }

      case 'ended': {
        const wasConnected = callStatusRef.current === 'connected';
        const dur = callDurationRef.current;
        if (payload.reason === 'refreshed') {
           // We can't use toast here directly because it's usually in useAppLogic, 
           // but we can dispatch a custom event.
           window.dispatchEvent(new CustomEvent('call_dropped', { detail: { reason: 'refreshed' } }));
        }
        if (wasConnected && callTypeRef.current) {
          recordCallEnd(callTypeRef.current, dur);
        }
        cleanupCall();
        break;
      }

      case 'camera_toggle': {
        setIsPartnerCameraOff(!!payload.off);
        break;
      }

      case 'screen_share_toggle': {
        console.log('[Call] screen_share_toggle received:', payload);
        if (payload.active) {
          partnerScreenTrackIdRef.current = payload.trackId;
          partnerScreenStreamIdRef.current = payload.streamId;
          setIsPartnerScreenSharing(true);
        } else {
          partnerScreenTrackIdRef.current = null;
          partnerScreenStreamIdRef.current = null;
          setIsPartnerScreenSharing(false);
          setRemoteScreenStream(null);
        }
        updateRemoteStreams();
        break;
      }

      case 'reaction': {
        window.dispatchEvent(new CustomEvent('call_reaction', { detail: { emoji: payload.emoji } }));
        break;
      }

      case 'raise_hand': {
        window.dispatchEvent(new CustomEvent('call_raise_hand', { detail: { raised: !!payload.raised } }));
        break;
      }

      default: break;
    }
  }, [userId, sendSignal, cleanupCall, createPC, applyPendingCandidates, recordCallEnd, echoCancellation, noiseSuppression, updateRemoteStreams]);

  // ── Supabase signaling channel ────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !userId) return;
    const channelId = `room_call_${roomId}`;
    const channel = supabase.channel(channelId, { config: { broadcast: { self: false, ack: false } } });
    callChannelRef.current = channel;
    channelReadyRef.current = false;

    channel
      .on('broadcast', { event: 'call_signal' }, ({ payload }) => handleSignal(payload))
      .on('presence', { event: 'sync' }, () => {
        try {
          const state = channel.presenceState();
          const partnerP = Object.values(state).flat().filter(Boolean).find(p => p && p.userId !== userId);
          setPartnerInCall(!!(partnerP?.inCall));
        } catch (_) {}
      })
      .subscribe(async (status) => {
        console.log('[Call] channel:', status);
        if (status === 'SUBSCRIBED') {
          channelReadyRef.current = true;
          flushQueue();
          try { await channel.track({ userId, inCall: false }); } catch (_) {}
        } else {
          channelReadyRef.current = false;
        }
      });

    return () => {
      channelReadyRef.current = false;
      try { channel.unsubscribe(); } catch (_) {}
      callChannelRef.current = null;
      if (window.__testTurn) delete window.__testTurn;
    };
  }, [roomId, userId, handleSignal, flushQueue]);

  // Expose test function globally for easier debugging in Dhaka



  // Update presence when call active
  useEffect(() => {
    if (channelReadyRef.current && callChannelRef.current) {
      try { callChannelRef.current.track({ userId, inCall: !!calling }); } catch (_) {}
    }
  }, [calling, userId]);

  // Network restore — attempt ICE restart
  useEffect(() => {
    const onOnline = () => {
      const pc = pcRef.current;
      if (pc && (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed')) {
        try { pc.restartIce(); } catch (_) {}
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  useEffect(() => {
    const h = ({ detail: { event, payload } }) => { if (event === 'call_signal') handleSignal(payload); };
    window.addEventListener('sync_broadcast', h);
    return () => window.removeEventListener('sync_broadcast', h);
  }, [handleSignal]);

  // Handle page refresh/unload
  useEffect(() => {
    const handleUnload = () => {
      if (callStatusRef.current !== 'idle') {
        sendSignal({ action: 'ended', reason: 'refreshed' });
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [sendSignal]);

  // ── Public API ────────────────────────────────────────────────────────────

  const startCall = useCallback(async (type) => {
    if (!partnerId || !userId) return;
    if (callingRef.current) return; // already in a call

    try {
      // Defensive: stop any lingering local tracks before re-acquiring camera/mic
      if (localStreamRef.current) {
        try { localStreamRef.current.getTracks().forEach(t => t.stop()); } catch(_){}
        localStreamRef.current = null; setLocalStream(null);
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation, 
          noiseSuppression, 
          autoGainControl: true,
          channelCount: 1
        }, 
        video: type === 'video' 
      });
      localStreamRef.current = stream;
      callTypeRef.current = type;
      isCallerRef.current = true;

      setLocalStream(stream);
      setCalling(type);
      setIsRinging(true);
      setIsCameraOff(type === 'audio');
      setCallStatus('connecting');

      const ringPayload = { action: 'ring', callType: type, fromName: userId };
      sendSignal(ringPayload);

      if (ringStopRef.current) ringStopRef.current();
      ringStopRef.current = createRingTone();

      // Retry ring every 4s
      ringRetryRef.current = setInterval(() => sendSignal(ringPayload), 4000);

      // 30s timeout → missed call
      ringTimeoutRef.current = setTimeout(() => {
        if (isRingingRef.current) {
          recordMissedCall(type);
          cleanupCall();
        }
      }, 30000);

    } catch (e) {
      console.error('[Call] startCall failed:', e);
      cleanupCall();
      alert('Could not access microphone/camera. Please check browser permissions.');
    }
  }, [partnerId, userId, partnerInCall, sendSignal, cleanupCall, recordMissedCall, echoCancellation, noiseSuppression]);

  const acceptCall = useCallback(async () => {
    const incoming = incomingCall;
    if (!incoming) return;

    if (ringStopRef.current) { ringStopRef.current(); ringStopRef.current = null; }
    isCallerRef.current = false;
    callTypeRef.current = incoming.type;

    try {
      // Defensive: stop any lingering local tracks before re-acquiring camera/mic
      if (localStreamRef.current) {
        try { localStreamRef.current.getTracks().forEach(t => t.stop()); } catch(_){}
        localStreamRef.current = null; setLocalStream(null);
      }
      // Get media early so it's ready when offer arrives
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation, 
          noiseSuppression, 
          autoGainControl: true 
        }, 
        video: incoming.type === 'video' 
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCalling(incoming.type);
      setIsRinging(false);
      setIncomingCall(null);
      setIsCameraOff(incoming.type === 'audio');
      setCallStatus('connecting');

      // Tell caller we accepted — they will now send the offer
      sendSignal({ action: 'accepted', callType: incoming.type });
    } catch (err) {
      console.error('[Call] acceptCall failed:', err);
      sendSignal({ action: 'ended' });
      cleanupCall();
      alert('Could not access microphone/camera. Please check browser permissions.');
    }
  }, [incomingCall, sendSignal, cleanupCall, echoCancellation, noiseSuppression]);

  const declineCall = useCallback(() => {
    if (ringStopRef.current) { ringStopRef.current(); ringStopRef.current = null; }
    sendSignal({ action: 'ended' });
    setIncomingCall(null);
    setIsRinging(false);
  }, [sendSignal]);

  const endCall = useCallback(() => {
    if (callTypeRef.current && callStatus === 'connected') {
      recordCallEnd(callTypeRef.current, callDuration);
    }
    sendSignal({ action: 'ended' });
    cleanupCall();
  }, [sendSignal, cleanupCall, recordCallEnd, callStatus, callDuration]);

  const toggleMic = useCallback(() => {
    setIsMuted(prev => {
      const muted = !prev;
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !muted; });
      return muted;
    });
  }, []);

  const toggleDeafen = useCallback(() => setIsDeafened(p => !p), []);

  const toggleCamera = useCallback(async () => {
    const wasOff = isCameraOff;
    const nowOff = !wasOff;
    setIsCameraOff(nowOff);
    
    // Signal to partner
    sendSignal({ action: 'camera_toggle', off: nowOff });

    if (!nowOff) {
      if (callTypeRef.current === 'audio') {
        callTypeRef.current = 'video';
        setCalling('video');
      }
      try {
        const vs = await navigator.mediaDevices.getUserMedia({ video: true });
        const vt = vs.getVideoTracks()[0];
        if (vt && localStreamRef.current && pcRef.current) {
          // Stop old video tracks first
          localStreamRef.current.getVideoTracks().forEach(t => {
            localStreamRef.current.removeTrack(t);
            t.stop();
          });
          localStreamRef.current.addTrack(vt);
          const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender) await sender.replaceTrack(vt); else pcRef.current.addTrack(vt, localStreamRef.current);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }
      } catch (e) { console.error('[Call] camera toggle failed:', e); setIsCameraOff(true); }
    } else {
      localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = false; });
    }
  }, [isCameraOff, sendSignal]);

  // ── ICE restart (caller-side only) ────────────────────────────────────────
  const restartIce = useCallback(() => {
    try { pcRef.current?.restartIce(); } catch (e) { console.warn('[Call] restartIce failed:', e); }
  }, []);

  // ── Change input device mid-call ────────────────────────────────────────────
  const changeDevice = useCallback(async (kind, deviceId) => {
    if (!localStreamRef.current || !pcRef.current) return;
    try {
      // Stop relevant old tracks first to avoid NotReadableError
      const oldTracks = kind === 'audioinput'
        ? localStreamRef.current.getAudioTracks()
        : localStreamRef.current.getVideoTracks();
      oldTracks.forEach(t => { localStreamRef.current.removeTrack(t); t.stop(); });

      const constraints = kind === 'audioinput'
        ? { audio: { deviceId: { exact: deviceId } } }
        : { video: { deviceId: { exact: deviceId } } };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack = kind === 'audioinput' ? newStream.getAudioTracks()[0] : newStream.getVideoTracks()[0];
      const sender = pcRef.current.getSenders().find(s => s.track?.kind === (kind === 'audioinput' ? 'audio' : 'video'));
      if (sender && newTrack) {
        await sender.replaceTrack(newTrack);
        localStreamRef.current.addTrack(newTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }
    } catch (e) { console.error('[Call] changeDevice failed:', e); }
  }, []);

  const startScreenShare = useCallback(async () => {
    if (!pcRef.current) return;
    try {
      const ss = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const st = ss.getVideoTracks()[0];
      screenTrackRef.current = st;
      
      pcRef.current.addTrack(st, ss);
      
      setIsScreenSharing(true);
      setLocalScreenStream(ss);
      sendSignal({ action: 'screen_share_toggle', active: true, trackId: st.id, streamId: ss.id });
      
      st.onended = () => stopScreenShare();
    } catch (e) { console.error('[Call] screen share failed:', e); }
  }, [sendSignal]);

  const stopScreenShare = useCallback(async () => {
    if (screenTrackRef.current) {
      try {
        const sender = pcRef.current?.getSenders().find(s => s.track === screenTrackRef.current);
        if (sender && pcRef.current) {
          pcRef.current.removeTrack(sender);
        }
      } catch (e) {
        console.error('[Call] removeTrack failed during screen share stop:', e);
      }
      try { screenTrackRef.current.stop(); } catch (_) {}
      screenTrackRef.current = null;
    }
    setIsScreenSharing(false);
    setLocalScreenStream(null);
    sendSignal({ action: 'screen_share_toggle', active: false });
  }, [sendSignal]);

  const sendReaction = useCallback((emoji) => {
    sendSignal({ action: 'reaction', emoji });
  }, [sendSignal]);

  const toggleRaiseHand = useCallback((raised) => {
    sendSignal({ action: 'raise_hand', raised });
  }, [sendSignal]);

  const testTurnConfig = useCallback(async () => {
    // Get the first TURN server config for logging
    const turnServer = getStaticIceServers().find(s => {
      const u = Array.isArray(s.urls) ? s.urls[0] : s.urls;
      return u?.includes('turn:');
    });
    console.log('[Debug] Starting TURN connectivity test...');
    
    const dynamicServers = await getFullIceServers();
    console.log('[WebRTC] Full ICE Server list:', dynamicServers);
    const pc = new RTCPeerConnection({ iceServers: dynamicServers });
    const results = [];
    const errors = [];
    
    pc.onicecandidateerror = (e) => {
      const err = `Error ${e.errorCode}: ${e.errorText}`;
      console.error(`[Debug] ICE Error on ${e.url}: ${err}`);
      errors.push({ code: e.errorCode, text: e.errorText, url: e.url });
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const type = e.candidate.candidate.split(' ')[7];
        results.push(type);
        console.log(`[Debug] Found candidate: ${type}`);
      } else {
        const hasRelay = results.includes('relay');
        console.log(`[Debug] Test Complete. Relay found: ${hasRelay}`);
        
        // Dispatch result with extra error info for the UI
        window.dispatchEvent(new CustomEvent('turn_test_result', { 
          detail: { 
            hasRelay, 
            types: results,
            errorCode: errors.length > 0 ? errors[0].code : null,
            errorText: errors.length > 0 ? errors[0].text : null
          } 
        }));
        pc.close();
      }
    };
    pc.createDataChannel('test');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return true;
  }, []);

  useEffect(() => {
    window.__testTurn = testTurnConfig;
    return () => { delete window.__testTurn; };
  }, [testTurnConfig]);

  const value = {
    calling, isRinging, incomingCall, callDuration, callStatus, callQuality,
    remoteStream, remoteScreenStream, localStream, localScreenStream, isMuted, isDeafened, isCameraOff, isScreenSharing,
    partnerInCall, isPartnerCameraOff,
    startCall,    acceptCall, declineCall, endCall, toggleMic, toggleDeafen, toggleCamera,
    startScreenShare, stopScreenShare, restartIce, changeDevice, testTurnConfig,
    sendReaction, toggleRaiseHand,
    isPartnerScreenSharing,
    sendData,
    noiseSuppression, setNoiseSuppression, echoCancellation, setEchoCancellation,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
