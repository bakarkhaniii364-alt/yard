# Yard
A private space for two. It offers an intimate, secure digital space tailored specifically for couples to stay connected, play games, watch movies, and share memories together.

## Features
* Encrypted chat
* Collaborative docs
* Video calls
* Chess + arcade games
* Scrapbook
* Watch together
* Lofi player

## Architecture
Each yard = exactly 2 users. Real-time via Supabase Realtime. 
Video calls via WebRTC (Supabase Realtime signaling). 
Hosted on Cloudflare Pages.

## Tech Stack
React 18, Vite, Tailwind, Supabase, PeerJS/WebRTC, 
Yjs + TipTap, chess.js, react-player, Cloudflare Pages

## Setup
Prerequisites: Node 18+, Supabase project, Cloudflare account

```bash
git clone https://github.com/bakarkhaniii364-alt/yard
cd yard
cp .env.example .env
# Fill in your values in .env
npm install
npm run dev
```

## Database
Run SQL files in Supabase SQL Editor in this order:
  1. docs/db/init.sql
  2. docs/db/migration_normalized.sql
  3. docs/db/security_hardening.sql
  4. docs/db/storage_policies.sql
  5. docs/db/security_fixes_phase1.sql

## Environment Variables
See .env.example. Set the same in Cloudflare Pages 
dashboard → Settings → Environment Variables.

## Deployment
Push to main → Cloudflare Pages auto-deploys.

## Running Tests
```bash
npx playwright test
```
