import express from 'express';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import cors from 'cors';
import Database from 'better-sqlite3';
import crypto from 'crypto';
const app = express();
const PORT = 8443; // Standard HTTPS port

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure CORS
app.use(cors({
  origin: ['https://shirezaks.com', 'https://www.shirezaks.com', 'https://shirezaks.com:8443', 'https://localhost:8443', 'https://localhost:443', 'https://localhost:8080'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-DIM-Version'],
}));

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Load SSL certificates
let privateKey, certificate, credentials;
try {
  privateKey = fs.readFileSync(path.join(__dirname, 'shirezaks.com+2-key.pem'), 'utf8');
  certificate = fs.readFileSync(path.join(__dirname, 'shirezaks.com+2.pem'), 'utf8');
  credentials = { key: privateKey, cert: certificate };
} catch (error) {

  console.error('Error loading SSL certificates:', error.message);
  throw new Error('Error loading SSL certificates');
}

// Initialize SQLite Database
let db;
try {
  db = new Database('dim.db');
  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      membershipId TEXT PRIMARY KEY,
      destinyVersion INTEGER,
      settings TEXT,
      loadouts TEXT,
      tags TEXT,
      searches TEXT,
      lastModified INTEGER DEFAULT (strftime('%s', 'now')),
      syncToken TEXT
    );
    CREATE TABLE IF NOT EXISTS api_keys (
      apiKey TEXT PRIMARY KEY,
      appName TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );
  `);
  
  // Add new columns if they don't exist (migration)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN lastModified INTEGER DEFAULT (strftime('%s', 'now'))`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN syncToken TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  
  // Update existing records that don't have lastModified timestamps
  try {
    const existingUsers = db.prepare('SELECT * FROM users WHERE lastModified IS NULL').all();
    if (existingUsers.length > 0) {
      const updateExistingRecords = db.prepare(`
        UPDATE users 
        SET lastModified = ?
        WHERE lastModified IS NULL
      `);
      const currentTime = Date.now();
      updateExistingRecords.run(currentTime);
      console.log(`Updated ${existingUsers.length} existing records with lastModified timestamps`);
    }
  } catch (migrationError) {
    // If the migration fails, it's likely because the columns don't exist yet
    console.log('Migration skipped - likely new database');
  }
} catch (error) {

  console.error('Error initializing database:', error.message);
  throw new Error('Error initializing database');
}

// Application-level API Key Validation Middleware
/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function validateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Unauthorized', message: 'X-API-Key header missing' });
  }

  const apiKeyRecord = db.prepare('SELECT * FROM api_keys WHERE apiKey = ?').get(apiKey);
  if (!apiKeyRecord) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid X-API-Key' });
  }
  // @ts-expect-error - req.appKey is not defined in Express Request type
  req.appKey = apiKey; // Attach app key to request
  next();
}

// Removed User-level Authentication Middleware (validateUserAuth)

// Removed generateSyncToken function - now using lastModified timestamps

// Helper to get user data - now expects membershipId and destinyVersion directly
/**
 * @param {string} membershipId
 * @param {number} destinyVersion
 */
function getUserData(membershipId, destinyVersion) {
  const targetMembershipId = membershipId;
  const targetDestinyVersion = destinyVersion;

  const stmt = db.prepare('SELECT * FROM users WHERE membershipId = ? AND destinyVersion = ?');
  let data = stmt.get(targetMembershipId, targetDestinyVersion);

  if (!data) {
    // Initialize with empty data if not found
    const currentTime = Date.now();
    data = {
      membershipId: targetMembershipId,
      destinyVersion: targetDestinyVersion,
      settings: JSON.stringify({}),
      loadouts: JSON.stringify([]),
      tags: JSON.stringify({}),
      searches: JSON.stringify([]),
      lastModified: currentTime,
      syncToken: null // Will be removed from database schema
    };
    const insertStmt = db.prepare('INSERT INTO users (membershipId, destinyVersion, settings, loadouts, tags, searches, lastModified) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insertStmt.run(data.membershipId, data.destinyVersion, data.settings, data.loadouts, data.tags, data.searches, data.lastModified);
  }

  // Parse the raw data
  const settings = JSON.parse(data.settings);
  const loadoutsArray = JSON.parse(data.loadouts);
  const tags = JSON.parse(data.tags);
  const searchesArray = JSON.parse(data.searches);
  
  // Convert loadouts from array to object keyed by loadout ID
  const loadoutsObject = {};
  if (Array.isArray(loadoutsArray)) {
    loadoutsArray.forEach(loadout => {
      if (loadout && loadout.id) {
        loadoutsObject[loadout.id] = loadout;
      }
    });
  }
  
  // Convert searches from array to object keyed by destinyVersion
  const searchesObject = {
    "1": [], // Destiny 1
    "2": []  // Destiny 2
  };
  if (Array.isArray(searchesArray)) {
    searchesArray.forEach(search => {
      if (search && search.type) {
        const destinyVersion = search.type.toString();
        if (searchesObject[destinyVersion]) {
          searchesObject[destinyVersion].push(search);
        }
      }
    });
  }

  const parsedData = {
    membershipId: data.membershipId,
    destinyVersion: data.destinyVersion,
    settings: settings,
    loadouts: loadoutsObject,
    tags: tags,
    searches: searchesObject,
    lastModified: data.lastModified
  };
  return parsedData;
}

// Helper to update user data - now expects membershipId and destinyVersion directly
/**
 * @param {string} membershipId
 * @param {number} destinyVersion
 * @param {any[]} updates
 */
function updateUserData(membershipId, destinyVersion, updates) {
  const existingData = getUserData(membershipId, destinyVersion); // Get existing data using the resolved membershipId
  const updatedData = { ...existingData };

  for (const update of updates) {
    switch (update.action) {
      case 'setting':
        updatedData.settings = { ...updatedData.settings, ...update.payload };
        break;
      case 'loadout':
        // updatedData.loadouts is now an object, not an array
        if (update.payload && update.payload.id) {
          updatedData.loadouts[update.payload.id] = update.payload;
        }
        break;
      case 'delete_loadout':
        // updatedData.loadouts is now an object, not an array
        // For delete_loadout, payload is the loadout ID directly (not an object with id property)
        if (update.payload) {
          delete updatedData.loadouts[update.payload];
        }
        break;
      case 'tag':
        // Store both tag and notes for each item
        updatedData.tags[update.payload.id] = {
          tag: update.payload.tag || undefined,
          notes: update.payload.notes || undefined,
          craftedDate: update.payload.craftedDate || undefined
        };
        // Remove the entry if both tag and notes are null/undefined
        if (!update.payload.tag && !update.payload.notes) {
          delete updatedData.tags[update.payload.id];
        }
        break;
      case 'search':
        // updatedData.searches is now an object with destinyVersion keys, not an array
        if (update.payload && update.payload.type) {
          const destinyVersion = update.payload.type.toString();
          if (!updatedData.searches[destinyVersion]) {
            updatedData.searches[destinyVersion] = [];
          }
          // Find existing search and update or add new one
          const searchArray = updatedData.searches[destinyVersion];
          const searchIndex = searchArray.findIndex(s => s.query === update.payload.query && s.type === update.payload.type);
          if (searchIndex !== -1) {
            searchArray[searchIndex] = update.payload;
          } else {
            searchArray.push(update.payload);
          }
        }
        break;
      case 'delete_search':
        // updatedData.searches is now an object with destinyVersion keys, not an array
        if (update.payload && update.payload.type) {
          const destinyVersion = update.payload.type.toString();
          if (updatedData.searches[destinyVersion]) {
            updatedData.searches[destinyVersion] = updatedData.searches[destinyVersion].filter(
              s => !(s.query === update.payload.query && s.type === update.payload.type)
            );
          }
        }
        break;
      // Add other update actions as needed
    }
  }

  // Convert data back to database format before storing
  // Convert loadouts object back to array for database storage
  const loadoutsArray = Object.values(updatedData.loadouts);
  
  // Convert searches object back to array for database storage
  const searchesArray = [];
  Object.entries(updatedData.searches).forEach(([destinyVersion, searches]) => {
    if (Array.isArray(searches)) {
      searches.forEach(search => {
        searchesArray.push({
          ...search,
          type: parseInt(destinyVersion, 10)
        });
      });
    }
  });

  // Update lastModified timestamp
  const currentTime = Date.now();

  const stmt = db.prepare(`
    UPDATE users SET
      settings = ?,
      loadouts = ?,
      tags = ?,
      searches = ?,
      lastModified = ?
    WHERE membershipId = ? AND destinyVersion = ?
  `);
  stmt.run(
    JSON.stringify(updatedData.settings),
    JSON.stringify(loadoutsArray),
    JSON.stringify(updatedData.tags),
    JSON.stringify(searchesArray),
    currentTime,
    existingData.membershipId, // Use existingData's ID and version
    existingData.destinyVersion
  );
  
  updatedData.lastModified = currentTime;
  return updatedData;
}


// Simple test route
app.get('/', (_req, res) => {
  res.send('DIM API Backend is running!');
});

// Removed /new_app endpoint

const apiRouter = express.Router();

// Use /api prefix for all API routes
app.use('/api', apiRouter);

// Mock endpoint for /platform_info - does not require authentication
apiRouter.get('/platform_info', (_req, res) => {
  res.json({
    settings: {
      dimApiEnabled: true,
      dimProfileMinimumRefreshInterval: 60, // 60 seconds
      // Add other global settings as needed
    },
  });
});

// Basic endpoint for /auth/token - requires application-level API key
apiRouter.post('/auth/token', validateApiKey, (_req, res) => {
  // Mock response for a successful token request
  res.json({
    accessToken: 'mock_access_token_12345',
    expiresInSeconds: 3600, // 1 hour
    inception: Date.now(),
  });
});

// Persistent endpoint for /profile (GET) - requires application-level API key
apiRouter.get('/profile', validateApiKey, (req, res) => {
  const { platformMembershipId, destinyVersion, components, lastModified } = req.query;

  if (!platformMembershipId || !destinyVersion) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing membershipId or destinyVersion' });
  }

  const userData = getUserData(String(platformMembershipId), parseInt(String(destinyVersion), 10));

  // Check if client's lastModified is up to date
  const clientLastModified = lastModified ? parseInt(String(lastModified), 10) : 0;
  if (clientLastModified >= userData.lastModified) {
    // Data hasn't changed, return minimal response
    return res.json({
      profile: {},
      syncToken: userData.lastModified, // Keep for frontend compatibility
      lastModified: userData.lastModified
    });
  }

  // Create the profile structure that matches IndexedDB format
  const profileKey = `${userData.membershipId}-d${userData.destinyVersion}`;
  
  // Convert loadouts object to array for ProfileResponse format
  const loadoutsArray = Object.values(userData.loadouts);
  const tagsArray = Object.values(userData.tags);
  
  // Convert searches object to array for ProfileResponse format  
  const searchesArray = [];
  Object.entries(userData.searches).forEach(([destinyVersion, searches]) => {
    if (Array.isArray(searches)) {
      searches.forEach(search => {
        searchesArray.push({
          ...search,
          type: parseInt(destinyVersion, 10)
        });
      });
    }
  });

  const profileResponse = {
    settings: userData.settings,
    loadouts: loadoutsArray,
    tags: tagsArray,
    searches: searchesArray,
    syncToken: userData.lastModified, // Keep for frontend compatibility
    lastModified: userData.lastModified,
  };

  // Filter components if requested
  if (components) {
    const componentsArray = String(components).split(',');
    const filteredResponse = {
      syncToken: profileResponse.syncToken,
      lastModified: profileResponse.lastModified
    };
    
    if (componentsArray.includes('settings')) { 
      filteredResponse.settings = profileResponse.settings; 
    }
    if (componentsArray.includes('loadouts')) { 
      filteredResponse.loadouts = profileResponse.loadouts;
    }
    if (componentsArray.includes('tags')) { 
      filteredResponse.tags = profileResponse.tags;
    }
    if (componentsArray.includes('searches')) { 
      filteredResponse.searches = profileResponse.searches; 
    }
    
    return res.json(filteredResponse);
  }
  
  res.json(profileResponse);
});

// Persistent endpoint for /profile (POST) - used for updates - requires application-level API key
apiRouter.post('/profile', validateApiKey, (req, res) => {
  const { platformMembershipId, destinyVersion, updates } = req.body;

  // Validate that updates array is always present
  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing or invalid updates array' });
  }

  // Use membershipId and destinyVersion from request body
  const targetMembershipId = platformMembershipId;
  const targetDestinyVersion = destinyVersion ? parseInt(destinyVersion, 10) : 0;

  updateUserData(targetMembershipId, targetDestinyVersion, updates);

  // Refined mock response for updates
  const results = updates.map(() => ({
    status: 'Success', // Simplified status as per user's expected response
  }));

  res.json({ results });
});

// Basic mock endpoint for /delete_all_data - requires application-level API key
apiRouter.post('/delete_all_data', validateApiKey, (req, res) => {
  const { platformMembershipId, destinyVersion } = req.body; // Assuming these are sent for deletion

  // Use membershipId and destinyVersion from request body
  const targetMembershipId = platformMembershipId;
  const targetDestinyVersion = destinyVersion ? parseInt(destinyVersion, 10) : 0;

  if (targetMembershipId && targetDestinyVersion) {
    const stmt = db.prepare('DELETE FROM users WHERE membershipId = ? AND destinyVersion = ?');
    stmt.run(targetMembershipId, targetDestinyVersion);
    res.json({ deleted: 0 }); // Always return 0 for now
  } else {
    // If no specific user, maybe delete all? Or return 0.
    res.json({ deleted: 0 });
  }
});

// Create HTTPS server
const httpsServer = https.createServer(credentials, app);

httpsServer.listen(PORT, () => {

  console.log(`HTTPS Server running on https://localhost:${PORT}`);
});
