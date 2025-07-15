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

export interface Conversation {
  id: string;
  roleId: string;
  title: string;
  messages: Array<{
    id: string;
    content: string;
    role: string;
    attachments?: { name: string; content: string; }[];
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface LLMSettings {
  provider: string;
  model: string;
}

class MCPDatabase {
  private db: IDBDatabase | null = null;
  
  async init(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('MCPAgent', 2);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Roles store
        if (!db.objectStoreNames.contains('roles')) {
          const roleStore = db.createObjectStore('roles', { keyPath: 'id' });
          roleStore.createIndex('name', 'name', { unique: true });
          roleStore.createIndex('isDefault', 'isDefault');
        }
        
        // Conversations store
        if (!db.objectStoreNames.contains('conversations')) {
          const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
          convStore.createIndex('roleId', 'roleId');
          convStore.createIndex('createdAt', 'createdAt');
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  async createDefaultRole(): Promise<Role> {
    const defaultRole: Role = {
      id: 'default',
      name: 'Default Assistant',
      systemPrompt: 'You are a helpful AI assistant. You can help with various tasks including coding, analysis, and general questions.',
      mcpConfig: {
        mcpServers: {}
      },
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await this.saveRole(defaultRole);
    return defaultRole;
  }

  async saveRole(role: Role): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['roles'], 'readwrite');
      const store = transaction.objectStore('roles');
      const request = store.put(role);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getRoles(): Promise<Role[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['roles'], 'readonly');
      const store = transaction.objectStore('roles');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getRole(id: string): Promise<Role | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['roles'], 'readonly');
      const store = transaction.objectStore('roles');
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRole(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['roles'], 'readwrite');
      const store = transaction.objectStore('roles');
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations'], 'readwrite');
      const store = transaction.objectStore('conversations');
      const request = store.put(conversation);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getConversationsByRole(roleId: string): Promise<Conversation[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations'], 'readonly');
      const store = transaction.objectStore('conversations');
      const index = store.index('roleId');
      const request = index.getAll(roleId);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveSetting(key: string, value: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put({ key, value });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSetting<T>(key: string): Promise<T | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);
      
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.value as T);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const mcpDB = new MCPDatabase();