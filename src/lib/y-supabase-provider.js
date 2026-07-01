import * as Y from 'yjs'
import { supabase } from './supabase.js'

function uint8ArrayToBase64(uint8) {
  let binary = '';
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(uint8[i]);
  return btoa(binary);
}

function base64ToUint8Array(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function makeClientId() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c=>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

export default class YSupabaseProvider {
  constructor(room, ydoc, opts = {}) {
    this.room = room;
    this.ydoc = ydoc;
    this.clientId = opts.clientId || makeClientId();
    this.channelId = `yjs_${room}`;
    this.awareness = this._createAwareness();
    this._onYUpdate = this._onYUpdate.bind(this);
    this._onRemote = this._onRemote.bind(this);

    // Subscribe to Supabase broadcast channel
    this.channel = supabase.channel(this.channelId);
    this.channel
      .on('broadcast', { event: 'yjs_update' }, ({ payload }) => this._onRemote(payload))
      .on('broadcast', { event: 'yjs_awareness' }, ({ payload }) => this._onRemote(payload))
      .subscribe((status) => {
        // noop
      });

    // Send local Y updates to Supabase
    this.ydoc.on('update', this._onYUpdate);

    // Announce presence
    this._announcePresence(opts.user || null);
  }

  _createAwareness() {
    const states = new Map();
    const listeners = new Set();
    return {
      setLocalState: (state) => {
        states.set(this.clientId, state);
        // broadcast
        this.channel.send({ type: 'broadcast', event: 'yjs_awareness', payload: { sender: this.clientId, state } });
        listeners.forEach(cb => cb());
      },
      getStates: () => states,
      on: (ev, cb) => { if (ev === 'change') listeners.add(cb); },
      off: (ev, cb) => { if (ev === 'change') listeners.delete(cb); }
    };
  }

  _announcePresence(user) {
    if (user) this.awareness.setLocalState({ user });
  }

  _onYUpdate(update) {
    try {
      const payload = { type: 'update', sender: this.clientId, update: uint8ArrayToBase64(update) };
      this.channel.send({ type: 'broadcast', event: 'yjs_update', payload });
    } catch (e) {
      console.warn('[YSUPABASE] send update failed', e);
    }
  }

  _onRemote(payload) {
    if (!payload) return;
    try {
      if (payload.sender === this.clientId) return; // ignore own
      if (payload.type === 'update' || payload.update) {
        const b64 = payload.update || payload.payload?.update || payload.update64;
        if (!b64) return;
        const uint8 = base64ToUint8Array(b64);
        Y.applyUpdate(this.ydoc, uint8);
      }
      if (payload.state) {
        // awareness update
        try {
          this.awareness.getStates().set(payload.sender, payload.state);
          // notify listeners
          this.awareness.on && this.awareness.on('change', () => {});
        } catch (e) {}
      }
    } catch (e) {
      console.error('[YSUPABASE] failed to apply remote payload', e);
    }
  }

  destroy() {
    try { this.ydoc.off('update', this._onYUpdate); } catch(_) {}
    try { supabase.removeChannel(this.channel); } catch(_) {}
  }
}
