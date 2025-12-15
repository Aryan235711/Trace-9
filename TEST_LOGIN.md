# Test Login Bypass

For mobile testing without OAuth setup:

1. On PC, login normally with Google OAuth
2. Open browser dev tools (F12)
3. Go to Application > Local Storage
4. Copy the `auth_token` value
5. On phone, go to: `http://192.168.29.103:5000/?token=PASTE_TOKEN_HERE`

This bypasses OAuth for testing purposes.

Alternative: Use the app without login by directly accessing:
- `http://192.168.29.103:5000/log` (if no auth required)
- `http://192.168.29.103:5000/dashboard` (if no auth required)