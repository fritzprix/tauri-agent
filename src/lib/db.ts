import Dexie, { Table } from "dexie";
import { Assistant } from "../types/chat";

// --- TYPE DEFINITIONS ---
export interface DatabaseObject {
  key: string;
  value: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CRUD<T> {
  upsert: (object: T) => Promise<void>;
  read: (key: string) => Promise<T | undefined>;
  delete: (key: string) => Promise<void>;
  getPage: (page: number, pageSize: number) => Promise<Page<T>>; // if pageSize is -1, return all items
  count: () => Promise<number>;
}

export interface DatabaseService {
  assistants: CRUD<Assistant>;
  objects: CRUD<DatabaseObject>;
}

class LocalDatabase extends Dexie {
  private static instance: LocalDatabase;
  public static getInstance(): LocalDatabase {
    if (!LocalDatabase.instance) {
      LocalDatabase.instance = new LocalDatabase();
    }
    return LocalDatabase.instance;
  }

  assistants!: Table<Assistant, string>;
  objects!: Table<DatabaseObject, string>;

  constructor() {
    super("MCPAgentDB");
    
    // Version 1: Original schema
    this.version(1).stores({
      assistants: "&id",
      objects: "&key",
    });
    
    // Version 2: Add proper indexes
    this.version(2).stores({
      assistants: "&id, createdAt, updatedAt, name",
      objects: "&key, createdAt, updatedAt", // Added timestamp indexes
    }).upgrade(async (tx) => {
      console.log("Upgrading database to version 2 - adding indexes");
      
      const now = new Date();
      
      // Fix assistants
      const assistants = await tx.table('assistants').toArray();
      for (const assistant of assistants) {
        if (!assistant.createdAt) assistant.createdAt = now;
        if (!assistant.updatedAt) assistant.updatedAt = now;
        await tx.table('assistants').put(assistant);
      }
      
      // Fix objects  
      const objects = await tx.table('objects').toArray();
      for (const obj of objects) {
        if (!obj.createdAt) obj.createdAt = now;
        if (!obj.updatedAt) obj.updatedAt = now;
        await tx.table('objects').put(obj);
      }
    });
  }
}

// Helper function to create paginated results
const createPage = <T>(items: T[], page: number, pageSize: number, totalItems: number): Page<T> => {
  if (pageSize === -1) {
    return {
      items,
      page: 1,
      pageSize: totalItems,
      totalItems,
      hasNextPage: false,
      hasPreviousPage: false
    };
  }

  return {
    items,
    page,
    pageSize,
    totalItems,
    hasNextPage: (page * pageSize) < totalItems,
    hasPreviousPage: page > 1
  };
};

export const dbService: DatabaseService = {
  assistants: {
    upsert: async (assistant: Assistant) => {
      const now = new Date();
      if (!assistant.createdAt) assistant.createdAt = now;
      assistant.updatedAt = now;
      await LocalDatabase.getInstance().assistants.put(assistant);
    },
    read: async (id: string) => {
      return LocalDatabase.getInstance().assistants.get(id);
    },
    delete: async (id: string) => {
      await LocalDatabase.getInstance().assistants.delete(id);
    },
    getPage: async (page: number, pageSize: number): Promise<Page<Assistant>> => {
      const db = LocalDatabase.getInstance();
      const totalItems = await db.assistants.count();
      
      if (pageSize === -1) {
        const items = await db.assistants.orderBy('createdAt').toArray();
        return createPage(items, page, pageSize, totalItems);
      }
      
      const offset = (page - 1) * pageSize;
      const items = await db.assistants
        .orderBy('createdAt')
        .offset(offset)
        .limit(pageSize)
        .toArray();
      
      return createPage(items, page, pageSize, totalItems);
    },
    count: async (): Promise<number> => {
      return LocalDatabase.getInstance().assistants.count();
    },
  },
  objects: {
    upsert: async (object: DatabaseObject) => {
      const now = new Date();
      if (!object.createdAt) object.createdAt = now;
      object.updatedAt = now;
      await LocalDatabase.getInstance().objects.put(object);
    },
    read: async (key: string) => {
      return LocalDatabase.getInstance().objects.get(key);
    },
    delete: async (key: string) => {
      await LocalDatabase.getInstance().objects.delete(key);
    },
    getPage: async (page: number, pageSize: number): Promise<Page<DatabaseObject>> => {
      const db = LocalDatabase.getInstance();
      const totalItems = await db.objects.count();
      
      if (pageSize === -1) {
        const items = await db.objects.orderBy('createdAt').toArray();
        return createPage(items, page, pageSize, totalItems);
      }
      
      const offset = (page - 1) * pageSize;
      const items = await db.objects
        .orderBy('createdAt')
        .offset(offset)
        .limit(pageSize)
        .toArray();
      
      return createPage(items, page, pageSize, totalItems);
    },
    count: async (): Promise<number> => {
      return LocalDatabase.getInstance().objects.count();
    },
  },
};

// Keep the original utility functions
export const dbUtils = {
  getAllAssistants: async (): Promise<Assistant[]> => {
    return LocalDatabase.getInstance().assistants.toArray();
  },
  
  getAllObjects: async (): Promise<DatabaseObject[]> => {
    return LocalDatabase.getInstance().objects.toArray();
  },
  
  assistantExists: async (id: string): Promise<boolean> => {
    const count = await LocalDatabase.getInstance().assistants.where('id').equals(id).count();
    return count > 0;
  },
  
  objectExists: async (key: string): Promise<boolean> => {
    const count = await LocalDatabase.getInstance().objects.where('key').equals(key).count();
    return count > 0;
  },
  
  clearAllAssistants: async (): Promise<void> => {
    await LocalDatabase.getInstance().assistants.clear();
  },
  
  clearAllObjects: async (): Promise<void> => {
    await LocalDatabase.getInstance().objects.clear();
  },
  
  bulkUpsertAssistants: async (assistants: Assistant[]): Promise<void> => {
    const now = new Date();
    assistants.forEach(assistant => {
      if (!assistant.createdAt) assistant.createdAt = now;
      assistant.updatedAt = now;
    });
    await LocalDatabase.getInstance().assistants.bulkPut(assistants);
  },
  
  bulkUpsertObjects: async (objects: DatabaseObject[]): Promise<void> => {
    const now = new Date();
    objects.forEach(obj => {
      if (!obj.createdAt) obj.createdAt = now;
      obj.updatedAt = now;
    });
    await LocalDatabase.getInstance().objects.bulkPut(objects);
  }
};