import { getLogger } from './logger';

const logger = getLogger('DBService');

// --- TYPE DEFINITIONS ---
// These types are used within the application logic.
// The DB service will handle conversion to storable formats.
export interface Role {
  id: string;
  name: string;
  systemPrompt: string;
  mcpConfig: {
    mcpServers?: Record<string, {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }>;
  };
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// --- STORABLE TYPES ---
// This type represents how Role data is stored in IndexedDB (e.g., dates as strings).
type StorableRole = Omit<Role, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string };

class DBService {
  private static instance: DBService;
  private dbPromise: Promise<IDBDatabase>;

  private constructor() {
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('MCPAgentDB', 3); // Version incremented for schema safety

      request.onerror = () => {
        logger.error('IndexedDB error:', { error: request.error });
        reject(request.error);
      };

      request.onsuccess = () => {
        logger.debug('Database initialized successfully.');
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        logger.info('Database upgrade needed.');
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('roles')) {
          db.createObjectStore('roles', { keyPath: 'id' });
        }
        // Removed unused 'conversations' object store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  public static getInstance(): DBService {
    if (!DBService.instance) {
      DBService.instance = new DBService();
    }
    return DBService.instance;
  }

  // --- PRIVATE HELPERS ---

  private getObjectStore = async (storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> => {
    const db = await this.dbPromise;
    return db.transaction(storeName, mode).objectStore(storeName);
  };

  private toStorableRole = (role: Role): StorableRole => ({
    ...role,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  });

  private fromStorableRole = (role: StorableRole): Role => ({
    ...role,
    createdAt: new Date(role.createdAt),
    updatedAt: new Date(role.updatedAt),
  });

  // --- PUBLIC API ---

  public async saveRole(role: Role): Promise<void> {
    const store = await this.getObjectStore('roles', 'readwrite');
    const storableRole = this.toStorableRole(role);
    return new Promise((resolve, reject) => {
      const request = store.put(storableRole);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getRoles(): Promise<Role[]> {
    const store = await this.getObjectStore('roles', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result.map(this.fromStorableRole));
      request.onerror = () => reject(request.error);
    });
  }

  public async deleteRole(id: string): Promise<void> {
    const store = await this.getObjectStore('roles', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async saveSetting(key: string, value: any): Promise<void> {
    const store = await this.getObjectStore('settings', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getSetting<T>(key: string): Promise<T | null> {
    const store = await this.getObjectStore('settings', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value as T ?? null);
      request.onerror = () => reject(request.error);
    });
  }
}

export const dbService = DBService.getInstance();
