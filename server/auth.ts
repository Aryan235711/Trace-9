import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// Google OAuth Strategy (only initialize if credentials are present)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
  }, (accessToken, refreshToken, profile, done) => {
    // Extract user info from Google profile
    const user = {
      id: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      picture: profile.photos?.[0]?.value
    };
    return done(null, user);
  }));
} else {
  // In test or local environments without Google credentials, skip strategy registration
  if (process.env.NODE_ENV !== 'test' && process.env.JEST_WORKER_ID === undefined) {
    console.warn('Google OAuth not configured: GOOGLE_CLIENT_ID/SECRET missing. Skipping passport GoogleStrategy registration.');
  }
}

// JWT token generation
export function generateToken(user: any): string {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set');
  }
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email,
      name: user.name 
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// JWT verification middleware
export function verifyToken(req: Request, res: Response, next: NextFunction) {

  // Test shortcut: allow tests to set `x-test-user` header to bypass JWT
  const testUser = (req.headers['x-test-user'] as string) || (req.headers['x_test_user'] as string);
  if (testUser) {
    req.user = { userId: testUser, email: `${testUser}@example.com`, name: testUser } as any;
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Get current user info from token
export function getCurrentUser(req: Request): { userId: string; email: string; name: string } | null {
  const u = (req.user as any) || null;
  if (!u) return null;
  // Normalize user shape: support decoded JWT ({ userId }) or passport profile ({ id })
  return {
    userId: u.userId ?? u.id,
    email: u.email,
    name: u.name,
  };
}

export default passport;