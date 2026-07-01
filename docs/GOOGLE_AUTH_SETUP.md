# Google OAuth Setup Guide

## Overview
This guide walks you through configuring Google authentication for Yard using your provided Google OAuth credentials.

**Credentials:**
- Client ID: `YOUR_GOOGLE_CLIENT_ID`
- Client Secret: `YOUR_GOOGLE_CLIENT_SECRET`

---

## Step 1: Configure Google OAuth in Supabase Dashboard

1. **Go to Supabase Dashboard**
   - Navigate to https://app.supabase.com
   - Select your project (yard)

2. **Enable Google Provider**
   - Go to **Authentication** → **Providers**
   - Find **Google** and click to enable it

3. **Enter Your Credentials**
   - **Client ID**: `YOUR_GOOGLE_CLIENT_ID`
   - **Client Secret**: `YOUR_GOOGLE_CLIENT_SECRET`
   - Click **Save**

4. **Configure Redirect URL in Google Cloud Console**
   - Your Supabase provider page shows the redirect URI format
   - It should look like: `https://<project-id>.supabase.co/auth/v1/callback`
   - Copy the full URL shown in Supabase

5. **Update Google Cloud Console**
   - Go to https://console.cloud.google.com
   - Select your Google project
   - Go to **APIs & Services** → **Credentials**
   - Find your OAuth 2.0 Client ID
   - Click **Edit**
   - In **Authorized redirect URIs**, add:
     ```
     https://<your-supabase-project-id>.supabase.co/auth/v1/callback
     ```
   - Add your local development URL if testing locally:
     ```
     http://localhost:5173/auth/v1/callback
     ```
   - Click **Save**

---

## Step 2: Test Google Login

1. **Start your app**
   ```bash
   npm run dev
   ```

2. **Navigate to login page** 
   - Go to http://localhost:5173/signin

3. **Click the Google button**
   - You should see the Google login popup
   - After authenticating, you'll be redirected to the dashboard

---

## Step 3: Deploy Configuration

When deploying to production on Cloudflare Pages:

1. **Add Environment Variables** (if not already set)
   - Supabase URL and keys are already in `.env`
   - No additional Google-specific env vars needed (handled by Supabase)

2. **Update Redirect URI in Google Cloud**
   - Add your production URL to authorized redirect URIs:
     ```
     https://your-domain.com/auth/v1/callback
     ```

3. **Verify in Supabase**
   - Confirm Google provider is enabled
   - Verify credentials are saved

---

## Troubleshooting

### "Invalid client" error
- Verify Client ID matches exactly in Supabase
- Check that the URL in Google Cloud Console matches your app URL

### Redirect URI mismatch
- Get the exact redirect URI from Supabase provider settings
- Add it precisely to Google Cloud Console (case-sensitive)
- Include `http://` for local dev, `https://` for production

### User not created after OAuth
- Check Supabase auto-signup is enabled: **Authentication** → **Settings** → Enable "Enable email confirmations" should be OFF for smooth signup
- User metadata (name, email) is automatically captured from Google

---

## How It Works

When a user clicks **Google**:

1. App calls `supabase.auth.signInWithOAuth({ provider: 'google', ... })`
2. Supabase redirects to Google login
3. Google authenticates the user
4. Google redirects back to your callback URL
5. Supabase creates/logs in the user automatically
6. App detects session and navigates to dashboard

**No additional code needed** — Supabase handles the entire flow.

---

## Backend Session Handling

Your AuthContext (`src/context/AuthContext.jsx`) automatically:
- Detects OAuth sessions via `supabase.auth.onAuthStateChange()`
- Extracts user email and name from `session.user.user_metadata`
- Persists session across page reloads
- Auto-refreshes expired tokens

---

## File Changes Made

✅ **Updated**: `src/views/Onboarding.jsx`
- Added Google OAuth button with proper styling
- Integrated with existing `handleOAuthLogin('google')` function

The frontend is **ready to go**. Just configure Supabase as described above.
