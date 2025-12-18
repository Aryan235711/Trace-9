import { db } from "./db";

export async function createTablesIfNotExist() {
  try {
    console.log("[db] Creating tables if they don't exist...");
    
    // Create users table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR UNIQUE,
        first_name VARCHAR,
        last_name VARCHAR,
        profile_image_url VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create sessions table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMP NOT NULL
      )
    `);
    
    // Create user_targets table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_targets (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        protein_target INTEGER NOT NULL DEFAULT 100,
        gut_target INTEGER NOT NULL DEFAULT 5,
        sun_target INTEGER NOT NULL DEFAULT 5,
        exercise_target INTEGER NOT NULL DEFAULT 5,
        sleep_baseline REAL,
        rhr_baseline REAL,
        hrv_baseline REAL,
        is_baseline_complete BOOLEAN NOT NULL DEFAULT false,
        active_intervention_id VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create daily_logs table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS daily_logs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date VARCHAR NOT NULL,
        sleep REAL NOT NULL,
        rhr REAL NOT NULL,
        hrv REAL NOT NULL,
        protein INTEGER NOT NULL,
        gut INTEGER NOT NULL,
        sun INTEGER NOT NULL,
        exercise INTEGER NOT NULL,
        symptom_score INTEGER NOT NULL,
        symptom_name VARCHAR,
        sleep_flag VARCHAR NOT NULL,
        rhr_flag VARCHAR NOT NULL,
        hrv_flag VARCHAR NOT NULL,
        protein_flag VARCHAR NOT NULL,
        gut_flag VARCHAR NOT NULL,
        sun_flag VARCHAR NOT NULL,
        exercise_flag VARCHAR NOT NULL,
        symptom_flag VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create interventions table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS interventions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        hypothesis_text VARCHAR NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        result VARCHAR,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log("[db] All tables created successfully!");
    return true;
  } catch (error) {
    console.error("[db] Failed to create tables:", error);
    return false;
  }
}