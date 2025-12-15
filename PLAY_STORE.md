# Play Store release approach (Trace-9)

This repo is a web app (Vite/React client + Express server). To publish on Google Play, you typically wrap the web experience in an Android app.

## Option A (Recommended): TWA (Trusted Web Activity)

**Best when:** you will host the app at a stable public HTTPS domain and you want Play Store distribution with near-zero native code.

### Requirements
- Public **HTTPS** URL (no localhost)
- A valid web app manifest at `/manifest.webmanifest`
- An `assetlinks.json` hosted at `/.well-known/assetlinks.json`
- A signing key (Android keystore)

### High-level steps
1. Deploy the web app to production (HTTPS domain).
2. Ensure manifest is reachable:
   - `https://<your-domain>/manifest.webmanifest`
3. Create an Android TWA project using **Bubblewrap**:
   - Install Node.js + Java 17 + Android SDK
   - `npm i -g @bubblewrap/cli`
   - `bubblewrap init --manifest https://<your-domain>/manifest.webmanifest`
4. Bubblewrap will generate the `assetlinks.json` content.
   - Upload it to: `https://<your-domain>/.well-known/assetlinks.json`
5. Build & sign the Android App Bundle (AAB) and upload to Play Console.

### Notes for auth / deep links
- Google OAuth redirects must include your production domain.
- If you use deep links, ensure routes work in SPA mode (they currently do via server-side SPA fallback).

## Option B: Capacitor wrapper

**Best when:** you want native plugins (push notifications, sensors, etc.) or you don’t want to rely on TWA constraints.

### Tradeoffs
- More native project maintenance (Android Studio, Gradle, keystore, etc.)
- Still needs a hosted backend unless you embed everything locally

### High-level steps
1. Add Capacitor and create an Android project:
   - `npm i @capacitor/core @capacitor/cli`
   - `npx cap init`
   - `npm i @capacitor/android`
   - `npx cap add android`
2. Configure Capacitor `webDir` to point at your built web assets.
3. `npm run build` then `npx cap copy android`.
4. Open in Android Studio, sign, and create AAB.

## Recommendation
- If this app will live at a stable HTTPS domain and you mainly want a Play Store listing: choose **TWA**.
- If you expect to add native features soon: choose **Capacitor**.

## What you need to decide next
1. Where will production be hosted (domain + provider)?
2. Do you need native features (push notifications / background sync / sensors)?
3. What Google OAuth redirect URIs should be in production?
