/**
 * audio.js — Unified SFX engine using Howler.js + Web Audio API synthesizers.
 *
 * Strategy:
 *  - UI / notification SFX → synthesized via Web Audio API (zero file deps, instant)
 *  - Pool & game SFX → also synthesized (avoids asset loading latency)
 *  - Howler.js is exported for any future file-based SFX sprites
 *
 * All functions respect the `enabled` flag (sfxEnabled from localStorage).
 */

import { Howl, Howler } from 'howler';
import { playSound, setSoundEnabled } from 'react-sounds';

// ── Global SFX Volume ────────────────────────────────────────────────────
export function setSfxVolume(enabled) {
  try { 
    Howler.volume(enabled ? 1 : 0);
    setSoundEnabled(enabled);
  } catch (_) {}
}

// ── Synthesized SFX (Web Audio API) ────────────────────────────────────────
// Shared AudioContext (one per app lifetime)
let _ctx = null;
function getCtx() {
  if (!_ctx || _ctx.state === 'closed') {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _ctx = new AC();
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function synth(fn) {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    fn(ctx, ctx.currentTime);
  } catch (e) {}
}

// ── Main SFX Dispatcher ─────────────────────────────────────────────────────
export function playAudio(type, enabled) {
  if (!enabled) return;

  // Haptics
  if (navigator.vibrate) {
    if (type === 'click' || type === 'chalk') navigator.vibrate(10);
    else if (type === 'send' || type === 'receive') navigator.vibrate(20);
    else if (type === 'notif') navigator.vibrate([30, 50, 30]);
    else if (type === 'win') navigator.vibrate([100, 50, 100]);
    else if (type === 'pool_hit') navigator.vibrate(15);
    else if (type === 'pool_sink') navigator.vibrate([40, 20, 40]);
  }

  synth((ctx, now) => {
    switch (type) {

      // ── UI & Notifications (via react-sounds) ───────────────────────────
      case 'click':
        playSound('ui/button_soft');
        break;
      case 'notif':
        playSound('notification/notification');
        break;
      case 'send':
        playSound('ui/send');
        break;
      case 'receive':
        playSound('notification/message');
        break;
      case 'win':
        playSound('arcade/level_up');
        break;
      case 'success':
        playSound('notification/success');
        break;

      // ── Drawing / Chalk SFX ─────────────────────────────────────────────
      case 'chalk': {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150 + Math.random() * 50, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.1);
        g.gain.setValueAtTime(0.05, now); g.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
        break;
      }

      case 'wood_thud': {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
        g.gain.setValueAtTime(0.2, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
        break;
      }

      case 'electronic_slide': {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        g.gain.setValueAtTime(0.05, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
        break;
      }

      // ── Pool Game SFX ───────────────────────────────────────────────────
      case 'pool_break': {
        // Multiple overlapping cracks = break shot impact
        for (let i = 0; i < 6; i++) {
          const osc = ctx.createOscillator(); const g = ctx.createGain();
          const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
          const data = buf.getChannelData(0);
          for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (ctx.sampleRate * 0.04));
          const src = ctx.createBufferSource();
          src.buffer = buf;
          const filt = ctx.createBiquadFilter();
          filt.type = 'bandpass';
          filt.frequency.value = 800 + Math.random() * 800;
          filt.Q.value = 1;
          src.connect(filt); filt.connect(ctx.destination);
          const t = now + i * 0.015;
          src.start(t); src.stop(t + 0.15);
        }
        break;
      }

      case 'pool_hit':
      case 'hit': {
        // Sharp ivory click of billiard ball collision
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.012));
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filt = ctx.createBiquadFilter();
        filt.type = 'highpass';
        filt.frequency.value = 1200;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.6, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        src.connect(filt); filt.connect(g); g.connect(ctx.destination);
        src.start(now); src.stop(now + 0.08);
        break;
      }

      case 'pool_cushion': {
        // Softer thud when ball hits cushion/rail
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);
        g.gain.setValueAtTime(0.25, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);

        // Add noise transient
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.008));
        }
        const src = ctx.createBufferSource(); src.buffer = buf;
        const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.3, now);
        src.connect(g2); g2.connect(ctx.destination);
        src.start(now); src.stop(now + 0.05);
        break;
      }

      case 'pool_sink':
      case 'sink': {
        // Satisfying "glunk" as ball drops into pocket
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.3);
        g.gain.setValueAtTime(0.35, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now); osc.stop(now + 0.35);

        // Secondary resonance thud
        const osc2 = ctx.createOscillator(); const g2 = ctx.createGain();
        osc2.connect(g2); g2.connect(ctx.destination);
        osc2.type = 'triangle'; osc2.frequency.value = 100;
        g2.gain.setValueAtTime(0.15, now + 0.05);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc2.start(now + 0.05); osc2.stop(now + 0.25);
        break;
      }

      default: break;
    }
  });
}

// ── Lo-Fi Background (unchanged) ────────────────────────────────────────────
let lofiCtx = null;
let lofiTimerId = null;
export function toggleLoFi(play) {
  if (play) {
    if (!lofiCtx) lofiCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (lofiCtx.state === 'suspended') lofiCtx.resume();
    const playNote = () => {
      if (!lofiCtx) return;
      const osc = lofiCtx.createOscillator(); const gain = lofiCtx.createGain();
      osc.connect(gain); gain.connect(lofiCtx.destination);
      const notes = [261.63, 293.66, 329.63, 392.00, 440.00];
      osc.frequency.value = notes[Math.floor(Math.random() * notes.length)] / 2;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, lofiCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.05, lofiCtx.currentTime + 1);
      gain.gain.linearRampToValueAtTime(0, lofiCtx.currentTime + 3);
      osc.start(lofiCtx.currentTime); osc.stop(lofiCtx.currentTime + 3);
      lofiTimerId = setTimeout(playNote, Math.random() * 2000 + 1000);
    };
    playNote();
  } else {
    if (lofiTimerId) { clearTimeout(lofiTimerId); lofiTimerId = null; }
    if (lofiCtx) { lofiCtx.close(); lofiCtx = null; }
  }
}

/**
 * createHowlSprite — helper for creating a Howler sprite instance.
 * Use this for any future file-based SFX bundles.
 *
 * @example
 * const gameSfx = createHowlSprite('/sounds/game.webm', {
 *   cardFlip: [0, 200],
 *   win: [300, 1500],
 * });
 * gameSfx.play('cardFlip');
 */
export function createHowlSprite(src, sprite) {
  return new Howl({ src: Array.isArray(src) ? src : [src], sprite });
}
