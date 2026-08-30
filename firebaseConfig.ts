// Automated High-Performance Real-Time Database Client
// Built for high concurrency, zero-lag delta sync, optimistic UI, persistent offline mutation queue, and auto-sync on reconnect

import { 
  RIDES, 
  OPERATORS, 
  TICKET_SALES_PERSONNEL, 
  COUNTERS, 
  MAINTENANCE_PERSONNEL, 
  FLOORS, 
  DEFAULT_PACKAGES,
  DEFAULT_APP_CONFIG
} from './constants';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer, onSnapshot, setDoc } from 'firebase/firestore';
import firebaseConfigJson from './firebase-applet-config.json';

export const isFirebaseConfigured = true;

// Direct Firebase Firestore Client Instance
export let clientFirestore: any = null;
try {
  if (firebaseConfigJson && firebaseConfigJson.apiKey) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfigJson) : getApp();
    clientFirestore = firebaseConfigJson.firestoreDatabaseId 
      ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
      : getFirestore(app);
  }
} catch (e) {
  console.warn('Firestore Client Init:', e);
}

// Validate Connection to Firestore on Boot
async function testFirestoreConnection() {
  if (!clientFirestore) return;
  try {
    await getDocFromServer(doc(clientFirestore, 'tfw_data', 'meta'));
  } catch (error: any) {
    // Graceful handling for quota limits or offline mode
    const msg = error?.message || String(error);
    if (!msg.includes('resource-exhausted') && !msg.includes('the client is offline') && !msg.includes('Quota limit exceeded')) {
      console.warn('Firestore connectivity info:', msg);
    }
  }
}

if (typeof window !== 'undefined') {
  testFirestoreConnection();
}

type ValueCallback = (snapshot: { val: () => any }) => void;

interface QueuedMutation {
  id: string;
  timestamp: number;
  type: 'set' | 'increment' | 'update' | 'remove';
  path?: string;
  value?: any;
  delta?: number;
  min?: number;
  updates?: Record<string, any>;
  basePath?: string;
}

class ServerDatabaseEngine {
  private cache: Record<string, any> = {};
  private listeners: Map<string, Set<ValueCallback>> = new Map();
  private sse: EventSource | null = null;
  private isConnected: boolean = false;
  private connectionListeners: Set<(connected: boolean) => void> = new Set();
  private pollInterval: any = null;
  private dbVersion: number = 0;
  public clientId: string = 'cli_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
  private syncDebounceTimer: any = null;
  private reconnectTimer: any = null;
  private offlineQueue: QueuedMutation[] = [];
  private isFlushingQueue: boolean = false;
  private firestoreUnsub: (() => void) | null = null;

  constructor() {
    // 1. Initialize local cache and offline queue from localStorage for instant 0ms startup & persistence
    try {
      const stored = localStorage.getItem('TFW_PERSISTENT_DB') || localStorage.getItem('TFW_PERSISTENT_DB_FALLBACK');
      if (stored) {
        this.cache = JSON.parse(stored);
      }
      const storedQueue = localStorage.getItem('TFW_OFFLINE_QUEUE');
      if (storedQueue) {
        this.offlineQueue = JSON.parse(storedQueue);
      }
    } catch (e) {
      console.warn('Could not read from localStorage:', e);
    }

    // 2. Listen to browser native online/offline & visibility/focus events for instant sync
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.connectStream();
        this.initFirestoreRealtimeListener();
        this.flushOfflineQueue();
        this.fetchFullDatabase();
      });
      window.addEventListener('offline', () => {
        this.setConnected(false);
      });
      window.addEventListener('focus', () => {
        this.fetchFullDatabase();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.fetchFullDatabase();
        }
      });
    }

    // 3. Start Direct Firestore Real-time WebChannel/WebSocket listener across all devices
    this.initFirestoreRealtimeListener();

    // 4. Start Real-time SSE Stream & initial sync fallback
    this.connectStream();
    this.fetchFullDatabase();

    // 5. Background synchronization interval (active health & version check every 3s)
    this.pollInterval = setInterval(() => {
      if (!this.isConnected) {
        this.fetchFullDatabase();
        if (!this.sse || this.sse.readyState === EventSource.CLOSED) {
          this.connectStream();
        }
      } else {
        // Periodic lightweight check to ensure multi-device version consistency
        this.checkServerVersion();
      }
    }, 3000);
  }

  // Direct Firestore real-time snapshot listener: Broadcasts instant multi-device mutations globally
  private initFirestoreRealtimeListener() {
    if (typeof window === 'undefined' || !clientFirestore) return;
    try {
      if (this.firestoreUnsub) {
        try { this.firestoreUnsub(); } catch (e) { /* ignore */ }
      }
      const docRef = doc(clientFirestore, 'tfw_data', 'app_state');
      this.firestoreUnsub = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const cloudData = docSnap.data();
          if (cloudData && (cloudData.data || cloudData.config)) {
            // Apply updates from other devices or cloud cold-boots
            if (cloudData._lastSenderId !== this.clientId || (cloudData.version && cloudData.version > this.dbVersion)) {
              this.applyCloudSnapshot(cloudData);
            }
          }
        }
        this.setConnected(true);
      }, (error: any) => {
        // Suppress repetitive quota warning logs in browser; SSE server stream handles real-time sync
        const msg = error?.message || String(error);
        if (!msg.includes('RESOURCE_EXHAUSTED') && !msg.includes('quota') && !msg.includes('resource-exhausted')) {
          console.warn('Real-time sync status:', msg);
        }
      });
    } catch (err) {
      // ignore
    }
  }

  private applyCloudSnapshot(cloudData: any) {
    if (!cloudData || typeof cloudData !== 'object') return;

    const newVersion = Math.max(cloudData.version || 1, this.dbVersion || 1);
    const newLastUpdated = cloudData.lastUpdated || new Date().toISOString();

    const merged: any = {
      version: newVersion,
      lastUpdated: newLastUpdated,
      config: {
        ...(this.cache?.config || {}),
        ...(cloudData.config || {})
      },
      data: {
        ...(this.cache?.data || {}),
        ...(cloudData.data || {})
      }
    };

    if (cloudData.config?.appConfig) {
      merged.config.appConfig = { ...cloudData.config.appConfig };
    }
    if (cloudData.config?.operators !== undefined) {
      merged.config.operators = cloudData.config.operators;
    }
    if (cloudData.config?.ticketSalesPersonnel !== undefined) {
      merged.config.ticketSalesPersonnel = cloudData.config.ticketSalesPersonnel;
    }
    if (cloudData.config?.maintenancePersonnel !== undefined) {
      merged.config.maintenancePersonnel = cloudData.config.maintenancePersonnel;
    }
    if (cloudData.config?.cxPersonnel !== undefined) {
      merged.config.cxPersonnel = cloudData.config.cxPersonnel;
    }
    if (cloudData.config?.rides !== undefined) {
      merged.config.rides = cloudData.config.rides;
    }
    if (cloudData.config?.counters !== undefined) {
      merged.config.counters = cloudData.config.counters;
    }
    if (cloudData.config?.packages !== undefined) {
      merged.config.packages = cloudData.config.packages;
    }

    this.cache = merged;
    this.dbVersion = newVersion;
    this.saveToLocalStorage();
    this.notifyAllListeners();
  }

  private async checkServerVersion() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const json = await res.json();
        if (json.dbVersion && json.dbVersion > this.dbVersion) {
          this.fetchFullDatabase();
        }
      }
    } catch (e) {
      // offline or server restarting
    }
  }

  private connectStream() {
    try {
      if (typeof window === 'undefined' || !window.EventSource) return;

      if (this.sse) {
        try { this.sse.close(); } catch (e) { /* ignore */ }
      }

      this.sse = new EventSource('/api/db/stream');

      this.sse.onopen = () => {
        this.setConnected(true);
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        // Flush any offline mutations as soon as the stream reconnects
        this.flushOfflineQueue();
      };

      this.sse.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerDelta(msg);
        } catch (e) {
          // ignore parsing errors (e.g. keepalive comments)
        }
      };

      this.sse.onerror = () => {
        this.setConnected(false);
        try { this.sse?.close(); } catch (e) {}
        this.sse = null;

        // Auto-reconnect with short backoff
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connectStream();
          }, 2000);
        }
      };
    } catch (e) {
      this.setConnected(false);
    }
  }

  private setConnected(connected: boolean) {
    if (this.isConnected !== connected) {
      this.isConnected = connected;
      this.connectionListeners.forEach(cb => cb(connected));
      if (connected) {
        this.flushOfflineQueue();
      }
    }
  }

  private saveOfflineQueue() {
    try {
      localStorage.setItem('TFW_OFFLINE_QUEUE', JSON.stringify(this.offlineQueue));
    } catch (e) {
      // ignore
    }
  }

  private enqueueOfflineMutation(mutation: Omit<QueuedMutation, 'id' | 'timestamp'>) {
    const item: QueuedMutation = {
      ...mutation,
      id: 'mut_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: Date.now()
    };
    this.offlineQueue.push(item);
    this.saveOfflineQueue();
  }

  // Flush and synchronize all queued mutations in exact order when back online
  public async flushOfflineQueue() {
    if (this.isFlushingQueue || this.offlineQueue.length === 0) return;
    this.isFlushingQueue = true;

    try {
      const queueToSync = [...this.offlineQueue];
      const res = await fetch('/api/db/sync-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue: queueToSync, senderId: this.clientId })
      });

      if (res.ok) {
        const data = await res.json();
        // Remove synced items from offline queue
        const processedCount = data.processed !== undefined ? data.processed : queueToSync.length;
        this.offlineQueue = this.offlineQueue.slice(processedCount);
        this.saveOfflineQueue();
        if (data.version) this.dbVersion = data.version;
        this.setConnected(true);
      }
    } catch (e) {
      // Still offline, will retry next time connection is active
    } finally {
      this.isFlushingQueue = false;
    }
  }

  // Handle incoming real-time deltas directly in memory without full-db roundtrip
  private handleServerDelta(msg: any) {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'connected') {
      if (msg.version && Math.abs(msg.version - this.dbVersion) > 3) {
        this.debouncedFetchFullDatabase();
      }
      return;
    }

    // Echo suppression: If this client initiated the mutation, local cache was already optimistically updated
    if (msg.senderId && msg.senderId === this.clientId) {
      if (msg.version) this.dbVersion = Math.max(this.dbVersion, msg.version);
      return;
    }

    const { type, path, value, delta, updates, date, version } = msg;
    if (version) {
      this.dbVersion = Math.max(this.dbVersion, version);
    }

    switch (type) {
      case 'set': {
        if (path) {
          this.setValueLocal(path, value);
          this.saveToLocalStorage();
          this.notifyPathListeners(path);
        }
        break;
      }
      case 'increment': {
        if (path) {
          if (value !== undefined) {
            this.setValueLocal(path, value);
          } else if (delta !== undefined) {
            const current = Number(this.getValue(path)) || 0;
            this.setValueLocal(path, Math.max(0, current + delta));
          }
          this.saveToLocalStorage();
          this.notifyPathListeners(path);
        }
        break;
      }
      case 'update': {
        if (updates && typeof updates === 'object') {
          const changedPaths: string[] = [];
          for (const [p, val] of Object.entries(updates)) {
            this.setValueLocal(p, val);
            changedPaths.push(p);
          }
          this.saveToLocalStorage();
          changedPaths.forEach(p => this.notifyPathListeners(p));
        }
        break;
      }
      case 'remove': {
        if (path) {
          this.setValueLocal(path, null);
          this.saveToLocalStorage();
          this.notifyPathListeners(path);
        }
        break;
      }
      case 'reset-day': {
        if (date) {
          if (this.cache?.data?.dailyCounts) delete this.cache.data.dailyCounts[date];
          if (this.cache?.data?.ticketSalesData) delete this.cache.data.ticketSalesData[date];
          if (this.cache?.data?.operatorAssignments) delete this.cache.data.operatorAssignments[date];
          if (this.cache?.data?.ticketSalesAssignments) delete this.cache.data.ticketSalesAssignments[date];
          if (this.cache?.data?.attendance) delete this.cache.data.attendance[date];
          if (this.cache?.data?.packageSales) delete this.cache.data.packageSales[date];
          if (this.cache?.data?.maintenanceTickets) delete this.cache.data.maintenanceTickets[date];
          this.saveToLocalStorage();
          this.notifyAllListeners();
        }
        break;
      }
      case 'sync':
      default: {
        this.debouncedFetchFullDatabase();
        break;
      }
    }
  }

  private debouncedFetchFullDatabase() {
    if (this.syncDebounceTimer) return;
    this.syncDebounceTimer = setTimeout(() => {
      this.syncDebounceTimer = null;
      this.fetchFullDatabase();
    }, 200);
  }

  private mergeDatabases(localDb: any, serverDb: any): { merged: any; shouldPushToServer: boolean } {
    if (!localDb || typeof localDb !== 'object') return { merged: serverDb, shouldPushToServer: false };
    if (!serverDb || typeof serverDb !== 'object') return { merged: localDb, shouldPushToServer: true };

    let shouldPushToServer = false;
    const merged: any = {
      version: Math.max(localDb.version || 1, serverDb.version || 1),
      lastUpdated: new Date().toISOString(),
      config: { ...(serverDb.config || {}), ...(localDb.config || {}) },
      data: { ...(serverDb.data || {}) }
    };

    // 1. Roles and Config Protection: preserve customized roles
    const localRoles = localDb.config?.appConfig?.roles || localDb.config?.roles;
    const serverRoles = serverDb.config?.appConfig?.roles || serverDb.config?.roles;

    if (Array.isArray(localRoles) && localRoles.length > 0) {
      if (!Array.isArray(serverRoles) || serverRoles.length === 0 || localRoles.length >= (serverRoles.length || 0)) {
        if (!merged.config.appConfig) merged.config.appConfig = {};
        merged.config.appConfig.roles = localRoles;
        merged.config.roles = localRoles;
        if (!serverRoles || localRoles.length > (serverRoles.length || 0)) {
          shouldPushToServer = true;
        }
      }
    }

    // Merge appConfig details
    merged.config.appConfig = {
      ...DEFAULT_APP_CONFIG,
      ...(serverDb.config?.appConfig || {}),
      ...(localDb.config?.appConfig || {})
    };
    if (localRoles && Array.isArray(localRoles) && localRoles.length > 0) {
      merged.config.appConfig.roles = localRoles;
      merged.config.roles = localRoles;
    }

    // 2. Data Collections Deep Merge (Preserve all historical dates and records)
    const collections = [
      'dailyCounts',
      'ticketSalesData',
      'operatorAssignments',
      'ticketSalesAssignments',
      'attendance',
      'packageSales',
      'maintenanceTickets',
      'historyLog'
    ];

    if (!merged.data) merged.data = {};

    collections.forEach(col => {
      const serverCol = serverDb.data?.[col] || {};
      const localCol = localDb.data?.[col] || {};
      
      const mergedCol: Record<string, any> = { ...serverCol };
      
      Object.keys(localCol).forEach(key => {
        if (mergedCol[key] === undefined || mergedCol[key] === null) {
          mergedCol[key] = localCol[key];
          shouldPushToServer = true;
        } else if (typeof localCol[key] === 'object' && typeof mergedCol[key] === 'object') {
          mergedCol[key] = { ...mergedCol[key], ...localCol[key] };
        }
      });

      merged.data[col] = mergedCol;
    });

    const serverHistoryCount = Object.keys(serverDb.data?.historyLog || {}).length;
    const localHistoryCount = Object.keys(localDb.data?.historyLog || {}).length;
    if (serverHistoryCount <= 1 && localHistoryCount > 1) {
      shouldPushToServer = true;
    }

    return { merged, shouldPushToServer };
  }

  public async fetchFullDatabase() {
    try {
      const res = await fetch('/api/db');
      if (res.ok) {
        const json = await res.json();
        if (json && json.db) {
          // Server is authoritative for all connected devices
          this.cache = json.db;
          this.dbVersion = Math.max(json.version || 1, this.dbVersion);
          this.saveToLocalStorage();
          this.notifyAllListeners();
          this.setConnected(true);

          // Flush any pending offline mutations in order
          if (this.offlineQueue.length > 0) {
            this.flushOfflineQueue();
          }
          return;
        }
      }
    } catch (err) {
      this.setConnected(false);
    }
  }

  private saveToLocalStorage() {
    try {
      const serialized = JSON.stringify(this.cache);
      localStorage.setItem('TFW_PERSISTENT_DB', serialized);
      localStorage.setItem('TFW_PERSISTENT_DB_FALLBACK', serialized);
    } catch (e) {
      // quota or private mode
    }
  }

  public subscribe(path: string, callback: ValueCallback) {
    const normalized = this.normalizePath(path);
    if (!this.listeners.has(normalized)) {
      this.listeners.set(normalized, new Set());
    }
    this.listeners.get(normalized)!.add(callback);

    // Immediate callback with current cached value
    const currentVal = this.getValue(normalized);
    callback({ val: () => currentVal });
  }

  public unsubscribe(path: string, callback?: ValueCallback) {
    const normalized = this.normalizePath(path);
    if (!callback) {
      this.listeners.delete(normalized);
      return;
    }
    const set = this.listeners.get(normalized);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(normalized);
      }
    }
  }

  public onConnectionChange(cb: (connected: boolean) => void) {
    this.connectionListeners.add(cb);
    cb(this.isConnected);
    return () => this.connectionListeners.delete(cb);
  }

  private normalizePath(path: string): string {
    if (!path) return '';
    return path.replace(/^\/+|\/+$/g, '');
  }

  // Fine-grained path listener notification to prevent unnecessary whole-app re-renders
  private notifyPathListeners(changedPath: string) {
    const normChanged = this.normalizePath(changedPath);

    this.listeners.forEach((callbacks, listenerPath) => {
      const normListener = this.normalizePath(listenerPath);
      
      // Match if listener is listening to root, or is parent/ancestor of changedPath, or is exact match/descendant
      const isMatch = 
        normListener === '' ||
        normChanged === '' ||
        normListener === normChanged ||
        normChanged.startsWith(normListener + '/') ||
        normListener.startsWith(normChanged + '/');

      if (isMatch) {
        const val = this.getValue(normListener);
        callbacks.forEach(cb => {
          try {
            cb({ val: () => val });
          } catch (e) {
            console.error('Error in listener callback:', e);
          }
        });
      }
    });
  }

  private notifyAllListeners() {
    this.listeners.forEach((callbacks, path) => {
      const val = this.getValue(path);
      callbacks.forEach(cb => {
        try {
          cb({ val: () => val });
        } catch (e) {
          console.error('Error in listener callback:', e);
        }
      });
    });
  }

  private cloneValue(val: any) {
    if (val === null || val === undefined) return val;
    if (typeof val !== 'object') return val;
    try {
      return JSON.parse(JSON.stringify(val));
    } catch (e) {
      if (Array.isArray(val)) return [...val];
      return { ...val };
    }
  }

  // Fast local save & server synchronization
  private pushToFirestoreClient() {
    // Client mutations synchronize via server API routes and SSE streams with debounced cloud persistence
  }

  // Force broadcast current view and active date across all connected devices
  public async syncViewEverywhere(activeDate?: string): Promise<boolean> {
    if (activeDate) {
      this.setValueLocal('config/appConfig/activeOperationalDate', activeDate);
      if (!this.cache.config) this.cache.config = {};
      if (!this.cache.config.appConfig) this.cache.config.appConfig = {};
      this.cache.config.appConfig.activeOperationalDate = activeDate;
      this.notifyPathListeners('config/appConfig');
    }
    this.dbVersion = (this.dbVersion || 1) + 1;
    if (this.cache) {
      this.cache.version = this.dbVersion;
      this.cache.lastUpdated = new Date().toISOString();
    }
    this.saveToLocalStorage();
    this.notifyAllListeners();

    // Server API broadcast (updates memory, disk, and notifies all connected devices via SSE)
    try {
      const res = await fetch('/api/db/broadcast-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          db: this.cache,
          activeDate,
          senderId: this.clientId
        })
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  public getValue(path: string) {
    const norm = this.normalizePath(path);
    if (!norm) return this.cloneValue(this.cache);
    const parts = norm.split('/').filter(Boolean);
    let current = this.cache;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return this.cloneValue(current);
  }

  private setValueLocal(path: string, value: any) {
    const norm = this.normalizePath(path);
    const parts = norm.split('/').filter(Boolean);
    if (parts.length === 0) {
      this.cache = value || {};
      return;
    }
    if (!this.cache || typeof this.cache !== 'object') {
      this.cache = {};
    } else {
      this.cache = { ...this.cache };
    }
    let current = this.cache;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      } else {
        current[part] = Array.isArray(current[part]) ? [...current[part]] : { ...current[part] };
      }
      current = current[part];
    }
    const lastPart = parts[parts.length - 1];
    if (value === null || value === undefined) {
      delete current[lastPart];
    } else {
      current[lastPart] = value;
    }
  }

  // 1. Optimistic set with server persistence & offline replay queue
  public async set(path: string, value: any) {
    const norm = this.normalizePath(path);
    this.setValueLocal(norm, value);
    this.saveToLocalStorage();
    this.notifyPathListeners(norm);
    this.pushToFirestoreClient();

    try {
      const res = await fetch('/api/db/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: norm, value, senderId: this.clientId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.version) this.dbVersion = data.version;
        this.setConnected(true);
      } else {
        throw new Error('Server returned ' + res.status);
      }
    } catch (e) {
      console.warn('Server set request failed, enqueued for offline sync:', e);
      this.enqueueOfflineMutation({ type: 'set', path: norm, value });
      this.setConnected(false);
    }
  }

  // 2. Atomic increment with optimistic update (concurrency safe & offline replay queue)
  public async increment(path: string, delta: number = 1, min: number = 0) {
    const norm = this.normalizePath(path);
    const currentVal = Number(this.getValue(norm)) || 0;
    const newVal = Math.max(min, currentVal + delta);
    
    // Optimistic local update
    this.setValueLocal(norm, newVal);
    this.saveToLocalStorage();
    this.notifyPathListeners(norm);
    this.pushToFirestoreClient();

    try {
      const res = await fetch('/api/db/increment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: norm, delta, min, senderId: this.clientId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.version) this.dbVersion = data.version;
        this.setConnected(true);
      } else {
        throw new Error('Server returned ' + res.status);
      }
    } catch (e) {
      console.warn('Server increment request failed, enqueued for offline sync:', e);
      this.enqueueOfflineMutation({ type: 'increment', path: norm, delta, min });
      this.setConnected(false);
    }
  }

  // 3. Optimistic batch update & offline replay queue
  public async update(updates: Record<string, any>, basePath: string = '') {
    const normBase = this.normalizePath(basePath);
    const formattedUpdates: Record<string, any> = {};

    for (const [key, value] of Object.entries(updates)) {
      let fullPath = key;
      if (!key.startsWith('data/') && !key.startsWith('config/')) {
        fullPath = normBase ? `${normBase}/${key}` : key;
      }
      fullPath = this.normalizePath(fullPath);
      formattedUpdates[fullPath] = value;
      this.setValueLocal(fullPath, value);
    }

    this.saveToLocalStorage();
    Object.keys(formattedUpdates).forEach(p => this.notifyPathListeners(p));
    this.pushToFirestoreClient();

    try {
      const res = await fetch('/api/db/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: formattedUpdates, basePath: normBase, senderId: this.clientId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.version) this.dbVersion = data.version;
        this.setConnected(true);
      } else {
        throw new Error('Server returned ' + res.status);
      }
    } catch (e) {
      console.warn('Server update request failed, enqueued for offline sync:', e);
      this.enqueueOfflineMutation({ type: 'update', updates: formattedUpdates, basePath: normBase });
      this.setConnected(false);
    }
  }

  // 4. Optimistic remove & offline replay queue
  public async remove(path: string) {
    const norm = this.normalizePath(path);
    this.setValueLocal(norm, null);
    this.saveToLocalStorage();
    this.notifyPathListeners(norm);
    this.pushToFirestoreClient();

    try {
      const res = await fetch('/api/db/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: norm, senderId: this.clientId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.version) this.dbVersion = data.version;
        this.setConnected(true);
      } else {
        throw new Error('Server returned ' + res.status);
      }
    } catch (e) {
      console.warn('Server remove request failed, enqueued for offline sync:', e);
      this.enqueueOfflineMutation({ type: 'remove', path: norm });
      this.setConnected(false);
    }
  }
}

// Global Engine Instance
const engine = new ServerDatabaseEngine();

class DatabaseReference {
  private path: string;

  constructor(path: string) {
    this.path = path;
  }

  on(eventType: string, callback: ValueCallback, errorCallback?: (error: any) => void) {
    if (this.path === '.info/connected') {
      const unsubscribe = engine.onConnectionChange((connected) => {
        callback({ val: () => connected });
      });
      return unsubscribe;
    }

    engine.subscribe(this.path, callback);
    return callback;
  }

  off(eventType?: string, callback?: ValueCallback) {
    engine.unsubscribe(this.path, callback);
  }

  async set(data: any) {
    return engine.set(this.path, data);
  }

  async increment(delta: number = 1, min: number = 0) {
    return engine.increment(this.path, delta, min);
  }

  async update(updates: Record<string, any>) {
    return engine.update(updates, this.path);
  }

  async remove() {
    return engine.remove(this.path);
  }

  async once(eventType: string, callback?: (snapshot: { val: () => any }) => void) {
    const value = engine.getValue(this.path);
    const snap = { val: () => value };
    if (callback) {
      callback(snap);
    }
    return snap;
  }
}

export const database = {
  ref: (path: string = '') => new DatabaseReference(path),
  syncViewEverywhere: (activeDate?: string) => engine.syncViewEverywhere(activeDate),
  engine
};
