import Database from 'better-sqlite3';

const db = new Database('d2l.db');

const API_KEY = '788600d2-9320-484e-86dd-5f5c9c458b66'; // Hardcoded API key from frontend
const APP_NAME = 'd2locker-dev'; // Corresponds to d2lAppName in frontend

try {
  // Create api_keys table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      apiKey TEXT PRIMARY KEY,
      appName TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );
  `);

  const stmt = db.prepare(
    'INSERT OR IGNORE INTO api_keys (apiKey, appName, createdAt) VALUES (?, ?, ?)',
  );
  const info = stmt.run(API_KEY, APP_NAME, Date.now());

  if (info.changes > 0) {
    console.log(`API key "${API_KEY}" for app "${APP_NAME}" inserted successfully.`);
  } else {
    console.log(
      `API key "${API_KEY}" for app "${APP_NAME}" already exists. No new record inserted.`,
    );
  }
} catch (error) {
  console.error('Error inserting API key:', error.message);
} finally {
  db.close();
}
