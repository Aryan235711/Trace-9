# Database & Auth Setup Instructions

## 1. Install New Dependencies

```bash
npm install jsonwebtoken passport-google-oauth20 dotenv
npm install --save-dev @types/jsonwebtoken @types/passport-google-oauth20
```

## 2. Configure Database

1. Open `.env` file
2. Replace `YOUR_PASSWORD_HERE` with your actual Supabase password:
   ```
   DATABASE_URL="postgresql://postgres:YOUR_ACTUAL_PASSWORD@db.jmticgpjuuzzbsuxdkqf.supabase.co:5432/postgres"
   ```

## 3. Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Set application type to "Web application"
6. Add authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
7. Copy Client ID and Client Secret to `.env`:
   ```
   GOOGLE_CLIENT_ID="your_google_client_id_here"
   GOOGLE_CLIENT_SECRET="your_google_client_secret_here"
   ```

## 4. Generate JWT Secret

```bash
# Generate a secure random string for JWT
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Add to `.env`:
```
JWT_SECRET="your_generated_jwt_secret_here"
```

## 5. Test Database Connection

```bash
npm run db:push
```

## 6. Start Development Server

```bash
npm install
npm run dev
```

## 7. Test Authentication

1. Visit `http://localhost:5000`
2. Click "Continue with Google"
3. Complete OAuth flow
4. Should redirect back to dashboard

## Files Created/Modified

- ✅ `.env` - Environment configuration
- ✅ `.gitignore` - Protect secrets
- ✅ `server/auth.ts` - Google OAuth + JWT
- ✅ `server/routes.ts` - Updated auth system
- ✅ `client/src/pages/LoginPage.tsx` - Login UI
- ✅ `client/src/hooks/useAuth.ts` - Auth state management
- ✅ `client/src/App.tsx` - Auth routing
- ✅ `client/src/lib/api.ts` - JWT headers

## Next Steps

After setup is complete, the app will have:
- ✅ Supabase PostgreSQL database
- ✅ Google OAuth authentication
- ✅ JWT session management
- ✅ Protected API routes
- ✅ Automatic auth state management