import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  RIDES, 
  OPERATORS, 
  TICKET_SALES_PERSONNEL, 
  COUNTERS, 
  MAINTENANCE_PERSONNEL, 
  CX_PERSONNEL,
  FLOORS, 
  DEFAULT_PACKAGES,
  DEFAULT_APP_CONFIG,
  DEFAULT_STAFF_ROLES
} from './constants';

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Initialize Data Directory
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create data directory:', e);
  }
}

// -------------------------------------------------------------
// Firebase Firestore Cloud Persistence Layer
// -------------------------------------------------------------
let firestoreDb: any = null;
let isFirestoreReady = false;

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (firebaseConfig && firebaseConfig.apiKey) {
      const app = getApps().length === 0 
        ? initializeApp({
            apiKey: firebaseConfig.apiKey,
            authDomain: firebaseConfig.authDomain,
            projectId: firebaseConfig.projectId,
            storageBucket: firebaseConfig.storageBucket,
            messagingSenderId: firebaseConfig.messagingSenderId,
            appId: firebaseConfig.appId,
          }, 'tfw-server-app')
        : getApp('tfw-server-app');

      firestoreDb = firebaseConfig.firestoreDatabaseId 
        ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
        : getFirestore(app);

      isFirestoreReady = true;
      console.log('✅ Firebase Firestore initialized successfully for cloud database:', firebaseConfig.firestoreDatabaseId || '(default)');
    }
  }
} catch (err) {
  console.warn('⚠️ Firebase Firestore server initialization warning:', err);
}

// Cloud persistence sync debounce & quota guard
let firestoreSyncTimeout: NodeJS.Timeout | null = null;
let lastFirestoreSenderId: string | null = null;
let firestoreQuotaExceededUntil = 0;
let hasLoggedQuotaWarning = false;

async function pushToFirestore(senderId?: string) {
  if (!firestoreDb || !memoryDb) return;
  if (Date.now() < firestoreQuotaExceededUntil) {
    return; // Active quota backoff, local disk and SSE stream handle real-time sync smoothly
  }
  try {
    const docRef = doc(firestoreDb, 'tfw_data', 'app_state');
    // Sanitize any undefined values before saving to Firestore
    const cleanDb = JSON.parse(JSON.stringify(memoryDb));
    const finalSenderId = senderId || lastFirestoreSenderId || null;
    await setDoc(docRef, {
      ...cleanDb,
      _lastSenderId: finalSenderId,
      _cloudSavedAt: new Date().toISOString()
    });
    hasLoggedQuotaWarning = false;
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota limit exceeded') || err?.code === 'resource-exhausted') {
      firestoreQuotaExceededUntil = Date.now() + 10 * 60 * 1000; // 10 min backoff
      if (!hasLoggedQuotaWarning) {
        console.warn('ℹ️ Firestore daily write quota limit reached. Operational engine is running seamlessly on high-performance local disk & real-time SSE stream.');
        hasLoggedQuotaWarning = true;
      }
    } else {
      console.warn('⚠️ Firestore sync note:', msg);
    }
  }
}

function scheduleFirestorePush(senderId?: string) {
  if (!isFirestoreReady) return;
  if (Date.now() < firestoreQuotaExceededUntil) return;
  if (senderId) lastFirestoreSenderId = senderId;
  if (firestoreSyncTimeout) clearTimeout(firestoreSyncTimeout);
  // Debounce writes by 5 seconds to preserve daily quota while persisting regularly
  firestoreSyncTimeout = setTimeout(() => {
    firestoreSyncTimeout = null;
    pushToFirestore(lastFirestoreSenderId || undefined);
  }, 5000);
}

// Load persisted data from Firestore on cold boot
async function syncFromFirestoreOnStartup(): Promise<boolean> {
  if (!firestoreDb) return false;
  try {
    console.log('🔄 Checking Firestore for saved park data...');
    const docRef = doc(firestoreDb, 'tfw_data', 'app_state');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const cloudData = docSnap.data();
      if (cloudData && (cloudData.data || cloudData.config)) {
        console.log(`✅ Loaded persistent park data from Firestore (version ${cloudData.version || 1})`);
        
        memoryDb = {
          version: Math.max(cloudData.version || 1, memoryDb?.version || 1),
          lastUpdated: cloudData.lastUpdated || new Date().toISOString(),
          config: {
            ...(memoryDb?.config || {}),
            ...(cloudData.config || {})
          },
          data: {
            ...(memoryDb?.data || {}),
            ...(cloudData.data || {})
          }
        };

        // Write to local disk cache immediately
        try {
          const serialized = JSON.stringify(memoryDb, null, 2);
          fs.writeFileSync(DB_FILE, serialized, 'utf-8');
          fs.writeFileSync(`${DB_FILE}.backup`, serialized, 'utf-8');
        } catch (e) {
          // ignore
        }
        return true;
      }
    } else {
      console.log('ℹ️ No existing Firestore document found. Will save upon first update.');
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota limit exceeded') || err?.code === 'resource-exhausted') {
      firestoreQuotaExceededUntil = Date.now() + 10 * 60 * 1000;
      console.warn('ℹ️ Firestore quota limit exceeded during startup. Running seamlessly with local persistent storage.');
    } else {
      console.warn('⚠️ Note during Firestore startup sync:', msg);
    }
  }
  return false;
}

// Initial Database Structure
function getInitialDatabase() {
  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    config: {
      appConfig: DEFAULT_APP_CONFIG,
      appName: 'TFW Operations Manager',
      appLogo: null,
      adminPassword: 'admin',
      cutoffHour: 22,
      currency: 'BDT',
      floors: FLOORS,
      packages: DEFAULT_PACKAGES,
      rides: RIDES,
      operators: OPERATORS,
      ticketSalesPersonnel: TICKET_SALES_PERSONNEL,
      counters: COUNTERS,
      maintenancePersonnel: MAINTENANCE_PERSONNEL,
      cxPersonnel: CX_PERSONNEL,
      otherSalesCategories: ['Merchandise', 'Food & Beverage', 'Photo Booth', 'Locker Rental', 'Game Tokens']
    },
    data: {
      dailyCounts: {},
      ticketSalesData: {},
      operatorAssignments: {},
      ticketSalesAssignments: {},
      attendance: {},
      packageSales: {},
      maintenanceTickets: {},
      historyLog: {
        [Date.now()]: {
          timestamp: new Date().toISOString(),
          user: 'System',
          action: 'SYSTEM_STARTUP',
          details: 'Automated database engine started successfully.'
        }
      }
    }
  };
}

// In-Memory Database with Disk Persistence
let memoryDb: any = null;
let sseClients: Array<{ id: number; res: express.Response }> = [];
let clientCounter = 0;

function loadDatabase(): any {
  if (memoryDb) return memoryDb;
  try {
    let targetFileToRead = DB_FILE;
    if (!fs.existsSync(DB_FILE) && fs.existsSync(`${DB_FILE}.backup`)) {
      targetFileToRead = `${DB_FILE}.backup`;
    }

    if (fs.existsSync(targetFileToRead)) {
      const fileData = fs.readFileSync(targetFileToRead, 'utf-8');
      const parsed = JSON.parse(fileData);
      
      // Ensure basic structure without overwriting existing data or user deletions
      if (!parsed.config || typeof parsed.config !== 'object') parsed.config = {};
      if (!parsed.data || typeof parsed.data !== 'object') parsed.data = {};
      if (!parsed.version) parsed.version = 1;
      
      // Initialize only missing data collections (preserve empty objects if user cleared them)
      if (parsed.data.dailyCounts === undefined) parsed.data.dailyCounts = {};
      if (parsed.data.ticketSalesData === undefined) parsed.data.ticketSalesData = {};
      if (parsed.data.operatorAssignments === undefined) parsed.data.operatorAssignments = {};
      if (parsed.data.ticketSalesAssignments === undefined) parsed.data.ticketSalesAssignments = {};
      if (parsed.data.attendance === undefined) parsed.data.attendance = {};
      if (parsed.data.packageSales === undefined) parsed.data.packageSales = {};
      if (parsed.data.maintenanceTickets === undefined) parsed.data.maintenanceTickets = {};
      if (parsed.data.historyLog === undefined) parsed.data.historyLog = {};

      // Initialize only missing config fields
      if (parsed.config.appConfig === undefined) {
        parsed.config.appConfig = DEFAULT_APP_CONFIG;
      } else {
        parsed.config.appConfig = {
          ...DEFAULT_APP_CONFIG,
          ...parsed.config.appConfig,
          roles: Array.isArray(parsed.config.appConfig.roles)
            ? parsed.config.appConfig.roles 
            : DEFAULT_STAFF_ROLES
        };
      }

      if (parsed.config.appName === undefined) parsed.config.appName = parsed.config.appConfig?.appName || 'TFW Operations Manager';
      if (parsed.config.roles === undefined) parsed.config.roles = parsed.config.appConfig?.roles || DEFAULT_STAFF_ROLES;
      if (parsed.config.rides === undefined) parsed.config.rides = RIDES;
      if (parsed.config.operators === undefined) parsed.config.operators = OPERATORS;
      if (parsed.config.ticketSalesPersonnel === undefined) parsed.config.ticketSalesPersonnel = TICKET_SALES_PERSONNEL;
      if (parsed.config.counters === undefined) parsed.config.counters = COUNTERS;
      if (parsed.config.maintenancePersonnel === undefined) parsed.config.maintenancePersonnel = MAINTENANCE_PERSONNEL;
      if (parsed.config.packages === undefined) parsed.config.packages = DEFAULT_PACKAGES;
      if (parsed.config.floors === undefined) parsed.config.floors = FLOORS;
      if (parsed.config.otherSalesCategories === undefined) {
        parsed.config.otherSalesCategories = ['Merchandise', 'Food & Beverage', 'Photo Booth', 'Locker Rental', 'Game Tokens'];
      }

      memoryDb = parsed;
      return memoryDb;
    }
  } catch (err) {
    console.error('Error reading database file, creating fresh initial db:', err);
  }

  memoryDb = getInitialDatabase();
  saveDatabaseToDisk();
  return memoryDb;
}

interface ServerMutationEvent {
  type: string;
  path?: string;
  value?: any;
  updates?: Record<string, any>;
  delta?: number;
  date?: string;
  activeDate?: string;
  senderId?: string;
  version?: number;
  force?: boolean;
}

let saveTimeout: NodeJS.Timeout | null = null;
function saveDatabaseToDisk(mutation?: ServerMutationEvent) {
  if (!memoryDb) return;
  memoryDb.version = (memoryDb.version || 0) + 1;
  memoryDb.lastUpdated = new Date().toISOString();

  // Instant synchronous write to disk ensuring local fast fallback
  try {
    const serialized = JSON.stringify(memoryDb, null, 2);
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, serialized, 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
    fs.writeFileSync(`${DB_FILE}.backup`, serialized, 'utf-8');
  } catch (e) {
    console.error('Failed to write database to disk safely:', e);
  }

  // Push to permanent Firebase Firestore cloud storage
  scheduleFirestorePush(mutation?.senderId);

  // Broadcast delta change via SSE to all connected clients
  broadcastMutation(mutation || { type: 'sync' });
}

function broadcastMutation(mutation: ServerMutationEvent) {
  const payload = JSON.stringify({
    ...mutation,
    version: memoryDb.version,
    timestamp: memoryDb.lastUpdated
  });
  sseClients.forEach(client => {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch (e) {
      // client disconnected
    }
  });
}

// Clean up old history records if they exceed 500 items
function trimHistoryLogs(db: any) {
  try {
    if (db?.data?.historyLog && typeof db.data.historyLog === 'object') {
      const keys = Object.keys(db.data.historyLog);
      if (keys.length > 500) {
        keys.sort((a, b) => Number(a) - Number(b));
        const toDelete = keys.slice(0, keys.length - 500);
        toDelete.forEach(k => delete db.data.historyLog[k]);
      }
    }
  } catch (e) {
    // ignore
  }
}

// Nested property helpers
function getValueByPath(obj: any, pathStr: string) {
  if (!pathStr) return obj;
  const parts = pathStr.split('/').filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

function setValueByPath(obj: any, pathStr: string, value: any) {
  const parts = pathStr.split('/').filter(Boolean);
  if (parts.length === 0) return value;
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  const lastPart = parts[parts.length - 1];
  if (value === null || value === undefined) {
    delete current[lastPart];
  } else {
    current[lastPart] = value;
  }
  return obj;
}

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 1. Load initial memory & local cache
  loadDatabase();

  // 2. Synchronize with Firestore cloud database on boot
  await syncFromFirestoreOnStartup();

  // --- API Routes ---
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      dbVersion: memoryDb?.version || 1,
      clients: sseClients.length,
      firestoreConnected: isFirestoreReady,
      time: new Date().toISOString()
    });
  });

  // Manual trigger for Cloud Sync (Firestore)
  app.post('/api/db/cloud-sync', async (req, res) => {
    try {
      await pushToFirestore();
      res.json({ success: true, message: 'Cloud database synced to Firestore successfully.', version: memoryDb?.version });
    } catch (err) {
      res.status(500).json({ error: 'Failed to sync to Firestore' });
    }
  });

  // Broadcast current view and state to all devices
  app.post('/api/db/broadcast-sync', async (req, res) => {
    try {
      const { db, activeDate, senderId } = req.body;
      if (db && typeof db === 'object') {
        memoryDb = {
          version: (memoryDb?.version || 1) + 1,
          lastUpdated: new Date().toISOString(),
          config: {
            ...(memoryDb?.config || {}),
            ...(db.config || {})
          },
          data: {
            ...(memoryDb?.data || {}),
            ...(db.data || {})
          }
        };
      }
      if (activeDate && memoryDb) {
        if (!memoryDb.config.appConfig) memoryDb.config.appConfig = {};
        memoryDb.config.appConfig.activeOperationalDate = activeDate;
      }
      saveDatabaseToDisk({ type: 'sync', activeDate, senderId, force: true });
      await pushToFirestore(senderId);
      broadcastMutation({ type: 'sync', activeDate, version: memoryDb?.version, force: true });
      res.json({ success: true, version: memoryDb?.version, message: 'Broadcast sync successful to all devices.' });
    } catch (err) {
      console.error('Error in broadcast-sync:', err);
      res.status(500).json({ error: 'Failed to broadcast sync.' });
    }
  });

  // Full DB or subpath
  app.get('/api/db', (req, res) => {
    const pathQuery = req.query.path as string;
    const db = loadDatabase();
    if (pathQuery) {
      const val = getValueByPath(db, pathQuery);
      return res.json({ success: true, data: val, version: db.version });
    }
    res.json({ success: true, db, version: db.version });
  });

  // Set single path
  app.post('/api/db/set', (req, res) => {
    const { path: pathStr, value, senderId } = req.body;
    if (pathStr === undefined) {
      return res.status(400).json({ error: 'path is required' });
    }
    const db = loadDatabase();
    setValueByPath(db, pathStr, value);
    if (pathStr.startsWith('data/historyLog')) {
      trimHistoryLogs(db);
    }
    saveDatabaseToDisk({ type: 'set', path: pathStr, value, senderId });
    res.json({ success: true, version: db.version });
  });

  // Atomic Increment/Decrement (High concurrency protection)
  app.post('/api/db/increment', (req, res) => {
    const { path: pathStr, delta = 1, min = 0, senderId } = req.body;
    if (!pathStr) {
      return res.status(400).json({ error: 'path is required' });
    }
    const db = loadDatabase();
    const currentVal = Number(getValueByPath(db, pathStr)) || 0;
    const newVal = Math.max(min, currentVal + Number(delta));
    setValueByPath(db, pathStr, newVal);
    saveDatabaseToDisk({ type: 'increment', path: pathStr, delta, value: newVal, senderId });
    res.json({ success: true, version: db.version, value: newVal });
  });

  // Batch sync queue for offline mutations
  app.post('/api/db/sync-queue', (req, res) => {
    const { queue, senderId } = req.body;
    if (!Array.isArray(queue) || queue.length === 0) {
      return res.json({ success: true, processed: 0, version: memoryDb?.version || 1 });
    }
    const db = loadDatabase();
    let processed = 0;
    const appliedUpdates: Record<string, any> = {};

    for (const op of queue) {
      if (!op || typeof op !== 'object') continue;
      const { type, path: pathStr, value, delta, min = 0, updates, basePath = '' } = op;

      if (type === 'set' && pathStr !== undefined) {
        setValueByPath(db, pathStr, value);
        appliedUpdates[pathStr] = value;
        processed++;
      } else if (type === 'increment' && pathStr) {
        const currentVal = Number(getValueByPath(db, pathStr)) || 0;
        const newVal = Math.max(min, currentVal + Number(delta || 1));
        setValueByPath(db, pathStr, newVal);
        appliedUpdates[pathStr] = newVal;
        processed++;
      } else if (type === 'update' && updates && typeof updates === 'object') {
        for (const [p, v] of Object.entries(updates)) {
          let full = p;
          if (!p.startsWith('data/') && !p.startsWith('config/')) {
            full = basePath ? `${basePath}/${p}` : p;
          }
          setValueByPath(db, full, v);
          appliedUpdates[full] = v;
        }
        processed++;
      } else if (type === 'remove' && pathStr) {
        setValueByPath(db, pathStr, null);
        appliedUpdates[pathStr] = null;
        processed++;
      }
    }

    if (Object.keys(appliedUpdates).some(k => k.includes('historyLog'))) {
      trimHistoryLogs(db);
    }

    saveDatabaseToDisk({ type: 'update', updates: appliedUpdates, senderId });
    res.json({ success: true, processed, version: db.version });
  });

  // Batch update
  app.post('/api/db/update', (req, res) => {
    const { updates, basePath = '', senderId } = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'updates object is required' });
    }
    const db = loadDatabase();
    for (const [p, val] of Object.entries(updates)) {
      setValueByPath(db, p, val);
    }
    if (Object.keys(updates).some(k => k.includes('historyLog'))) {
      trimHistoryLogs(db);
    }
    saveDatabaseToDisk({ type: 'update', updates, senderId });
    res.json({ success: true, version: db.version });
  });

  // Remove path
  app.post('/api/db/remove', (req, res) => {
    const { path: pathStr, senderId } = req.body;
    if (!pathStr) {
      return res.status(400).json({ error: 'path is required' });
    }
    const db = loadDatabase();
    setValueByPath(db, pathStr, null);
    saveDatabaseToDisk({ type: 'remove', path: pathStr, senderId });
    res.json({ success: true, version: db.version });
  });

  // Reset specific day data
  app.post('/api/db/reset-day', (req, res) => {
    const { date, senderId } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }
    const db = loadDatabase();
    if (db.data.dailyCounts) delete db.data.dailyCounts[date];
    if (db.data.ticketSalesData) delete db.data.ticketSalesData[date];
    if (db.data.operatorAssignments) delete db.data.operatorAssignments[date];
    if (db.data.ticketSalesAssignments) delete db.data.ticketSalesAssignments[date];
    if (db.data.attendance) delete db.data.attendance[date];
    if (db.data.packageSales) delete db.data.packageSales[date];
    if (db.data.maintenanceTickets) delete db.data.maintenanceTickets[date];
    saveDatabaseToDisk({ type: 'reset-day', date, senderId });
    res.json({ success: true, message: `Data for ${date} successfully reset.` });
  });

  // Export full database
  app.get('/api/db/export', (req, res) => {
    const db = loadDatabase();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=TFW_DB_Export_${new Date().toISOString().split('T')[0]}.json`);
    res.send(JSON.stringify(db, null, 2));
  });

  // Import / Restore full database
  app.post('/api/db/import', (req, res) => {
    const backup = req.body;
    if (!backup || (!backup.config && !backup.data)) {
      return res.status(400).json({ error: 'Invalid backup JSON format.' });
    }
    const initial = getInitialDatabase();
    memoryDb = {
      version: (memoryDb?.version || 1) + 1,
      lastUpdated: new Date().toISOString(),
      config: backup.config || initial.config,
      data: backup.data || initial.data
    };
    saveDatabaseToDisk({ type: 'sync' });
    res.json({ success: true, message: 'Database imported successfully.' });
  });

  // Server-Sent Events (SSE) for Real-Time synchronization with Keepalive Heartbeat
  app.get('/api/db/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const clientId = ++clientCounter;
    const client = { id: clientId, res };
    sseClients.push(client);

    // Send immediate initial handshake
    res.write(`data: ${JSON.stringify({ type: 'connected', version: memoryDb?.version || 1 })}\n\n`);

    req.on('close', () => {
      sseClients = sseClients.filter(c => c.id !== clientId);
    });
  });

  // Periodic Keepalive ping every 15s to keep connections alive through reverse proxies
  setInterval(() => {
    sseClients.forEach(client => {
      try {
        client.res.write(': keepalive\n\n');
      } catch (e) {
        // client disconnected
      }
    });
  }, 15000);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TFW Database and Operations Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
