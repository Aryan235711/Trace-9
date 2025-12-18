import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Simple Google OAuth configuration
const getGoogleConfig = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  console.log("[auth-debug] Google OAuth config", {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    clientId: clientId?.substring(0, 20) + "..."
  });
  
  return { clientId, clientSecret };
};

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(user: any, profile: any, accessToken: string, refreshToken?: string) {
  user.id = profile.id;
  user.email = profile.emails?.[0]?.value;
  user.name = profile.displayName;
  user.access_token = accessToken;
  user.refresh_token = refreshToken;
  user.expires_at = Math.floor(Date.now() / 1000) + 3600; // 1 hour
}

async function upsertUser(profile: any) {
  const name = profile.displayName || '';
  const [firstName, ...lastNameParts] = name.split(' ');
  const lastName = lastNameParts.join(' ');
  
  await storage.upsertUser({
    id: profile.id,
    email: profile.emails?.[0]?.value,
    firstName: firstName || '',
    lastName: lastName || '',
    profileImageUrl: profile.photos?.[0]?.value,
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const { clientId, clientSecret } = getGoogleConfig();
  
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }

  // Configure Google OAuth Strategy
  passport.use(new GoogleStrategy({
    clientID: clientId,
    clientSecret: clientSecret,
    callbackURL: "/api/callback"
  }, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      console.log("[auth-debug] Google OAuth success", {
        profileId: profile.id,
        email: profile.emails?.[0]?.value
      });
      
      const user = {};
      updateUserSession(user, profile, accessToken, refreshToken);
      await upsertUser(profile);
      done(null, user);
    } catch (error) {
      console.error("[auth-debug] OAuth verify error", error);
      done(error, null);
    }
  }));

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", passport.authenticate("google", {
    scope: ["profile", "email"]
  }));

  app.get("/api/callback", 
    passport.authenticate("google", { failureRedirect: "/api/login" }),
    (req, res) => {
      console.log("[auth-debug] OAuth callback success");
      res.redirect("/");
    }
  );

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};
