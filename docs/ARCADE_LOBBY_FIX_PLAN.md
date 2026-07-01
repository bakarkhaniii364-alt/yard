# Arcade Lobby & Pictionary — Fix Plan

**Created:** May 25, 2026  
**Related:** [CSP_FIX_PLAN.md](./CSP_FIX_PLAN.md), [SECURITY_FIX_TASKS.md](./SECURITY_FIX_TASKS.md)

These console errors are **not CSP** — they are Supabase query behavior and a missing WebRTC API.

---

## Error 1: `406 Not Acceptable` on `arcade_sessions`

### What you saw

```
GET .../arcade_sessions?select=*&room_id=eq....&game_id=eq.pictionary 406 (Not Acceptable)
```

### What it means

PostgREST returns **406** when you use `.single()` but the query returns **0 rows** (no session row yet). The lobby then calls `joinSession()` and creates the row — so the game often still works; the 406 is noisy, not fatal.

### Fix (applied)

**File:** `src/hooks/useArcadeSession.js`

- Changed `.single()` → `.maybeSingle()` (0 rows → `data: null`, no error)
- Log other errors except `PGRST116`

### Verify

1. Open Pictionary lobby (fresh, no prior session)
2. Network tab: first `arcade_sessions` request should be **200**, not 406
3. Logs: `🚦 [LOBBY] Bootstrapping session` → `Session created` still appear

---

## Error 2: `Uncaught TypeError: Ee is not a function` (Pictionary)

### What you saw

Hundreds of errors in `games-*.js` during lobby → STARTING → drawing, on pointer move / click.

### Root cause

`PictionaryGame` calls `sendData()` from `useCall()`, but **`CallContext` did not export `sendData`** after the PeerJS → native WebRTC migration. `sendData` was `undefined`, so every mouse move on the canvas threw.

Drawing sync falls back to Supabase broadcast (`useBroadcast`) when P2P is unavailable — but the code called `sendData()` without checking.

### Fixes (applied)

| File | Change |
|------|--------|
| `src/context/CallContext.jsx` | Added `sendData`, RTC data channel (`yard-data`), `webrtc_data` events during calls |
| `src/games/PictionaryGame.jsx` | Guard: only call `sendData` if `typeof sendData === 'function'` |
| `src/games/UnoGame.jsx` | Same guard |

### Behavior after fix

- **No active call:** `sendData` returns `false` → Supabase broadcast used (works for arcade games)
- **During voice/video call:** data channel may carry draws/cursor (lower latency)

### Verify

1. Start Pictionary with partner, reach drawing phase
2. Move mouse on canvas — **no** `is not a function` spam
3. Partner sees strokes (broadcast or P2P if in call)

---

## Error 3: `[E2EE] Sending unencrypted message`

### What it means

Informational — chat encryption key not ready yet. Unrelated to arcade lobby. Safe to ignore for this fix.

---

## Step-by-step test (after deploy)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Hard refresh production build | New JS bundle loaded |
| 2 | Activities → Pictionary → Partner lobby | No 406 on first session fetch |
| 3 | Both click "I'm Ready" | Countdown → game prep screen |
| 4 | Host starts round, drawer moves mouse | No TypeError flood |
| 5 | Guesser sees drawing updates | Realtime sync works |

---

## Files changed

```
src/hooks/useArcadeSession.js     — maybeSingle()
src/context/CallContext.jsx       — sendData + data channel
src/games/PictionaryGame.jsx      — safe sendData
src/games/UnoGame.jsx             — safe sendData
```

---

## Additional fixes (same release)

| Issue | Fix |
|-------|-----|
| Lobby session not updating after join | `joinSession` / `setReady` now call `setSession()` from RPC response |
| Game config lost (genre, rounds) | `handleCreateLobby` saves `game_state` via `updateGameState()` |
| Lobby phase stuck | Removed wrong `playing` → `STARTING` mapping; reset phase on leave |
| Pictionary state updates stale | `updateSyncState` supports functional updaters; App passes through |
| SyncWatcher search | Centralized in `src/utils/cinemaApi.js`; clearer CSP errors |

---

## Session log

| Date | Change |
|------|--------|
| 2026-05-25 | Documented 406 + sendData bugs; fixes applied in repo |
| 2026-05-25 | Arcade lobby sync, game_state config, Pictionary, SyncWatcher cinema API |
