import Dexie, { Table } from "dexie";
import { Assistant, Session, StreamableMessage } from "../types/chat";

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
  upsertMany: (objects: T[]) => Promise<void>;
  read: (key: string) => Promise<T | undefined>;
  delete: (key: string) => Promise<void>;
  getPage: (page: number, pageSize: number) => Promise<Page<T>>; // if pageSize is -1, return all items
  count: () => Promise<number>;
}

export interface DatabaseService {
  assistants: CRUD<Assistant>;
  objects: CRUD<DatabaseObject>;
  sessions: CRUD<Session>;
  messages: CRUD<StreamableMessage>;
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
  sessions!: Table<Session, string>;
  messages!: Table<StreamableMessage, string>;

  constructor() {
    super("MCPAgentDB");

    // Version 1: Original schema
    this.version(1).stores({
      assistants: "&id",
      objects: "&key",
    });

    // Version 2: Add proper indexes
    this.version(2)
      .stores({
        assistants: "&id, createdAt, updatedAt, name",
        objects: "&key, createdAt, updatedAt", // Added timestamp indexes
      })
      .upgrade(async (tx) => {
        console.log("Upgrading database to version 2 - adding indexes");

        const now = new Date();

        // Fix assistants
        await tx
          .table("assistants")
          .toCollection()
          .modify((assistant) => {
            if (!assistant.createdAt) assistant.createdAt = now;
            if (!assistant.updatedAt) assistant.updatedAt = now;
          });

        // Fix objects
        await tx
          .table("objects")
          .toCollection()
          .modify((obj) => {
            if (!obj.createdAt) obj.createdAt = now;
            if (!obj.updatedAt) obj.updatedAt = now;
          });
      });

    // Version 3: Add sessions and messages tables
    this.version(3)
      .stores({
        sessions: "&id, createdAt, updatedAt",
        messages: "&id, sessionId, createdAt", // Added index on sessionId for efficient querying
      })
      .upgrade(async () => {
        console.log(
          "Upgrading database to version 3 - adding sessions and messages tables",
        );
      });
  }
}

// Helper function to create paginated results
const createPage = <T>(
  items: T[],
  page: number,
  pageSize: number,
  totalItems: number,
): Page<T> => {
  if (pageSize === -1) {
    return {
      items,
      page: 1,
      pageSize: totalItems,
      totalItems,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }

  return {
    items,
    page,
    pageSize,
    totalItems,
    hasNextPage: page * pageSize < totalItems,
    hasPreviousPage: page > 1,
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
    upsertMany: async (assistants: Assistant[]) => {
      const now = new Date();
      const updatedAssistants = assistants.map((assistant) => ({
        ...assistant,
        createdAt: assistant.createdAt || now,
        updatedAt: now,
      }));
      await LocalDatabase.getInstance().assistants.bulkPut(updatedAssistants);
    },
    read: async (id: string) => {
      return LocalDatabase.getInstance().assistants.get(id);
    },
    delete: async (id: string) => {
      await LocalDatabase.getInstance().assistants.delete(id);
    },
    getPage: async (
      page: number,
      pageSize: number,
    ): Promise<Page<Assistant>> => {
      const db = LocalDatabase.getInstance();
      const totalItems = await db.assistants.count();

      if (pageSize === -1) {
        const items = await db.assistants.orderBy("createdAt").toArray();
        return createPage(items, page, pageSize, totalItems);
      }

      const offset = (page - 1) * pageSize;
      const items = await db.assistants
        .orderBy("createdAt")
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
    upsertMany: async (objects: DatabaseObject[]) => {
      const now = new Date();
      const updatedObjects = objects.map((obj) => ({
        ...obj,
        createdAt: obj.createdAt || now,
        updatedAt: now,
      }));
      await LocalDatabase.getInstance().objects.bulkPut(updatedObjects);
    },
    read: async (key: string) => {
      return LocalDatabase.getInstance().objects.get(key);
    },
    delete: async (key: string) => {
      await LocalDatabase.getInstance().objects.delete(key);
    },
    getPage: async (
      page: number,
      pageSize: number,
    ): Promise<Page<DatabaseObject>> => {
      const db = LocalDatabase.getInstance();
      const totalItems = await db.objects.count();

      if (pageSize === -1) {
        const items = await db.objects.orderBy("createdAt").toArray();
        return createPage(items, page, pageSize, totalItems);
      }

      const offset = (page - 1) * pageSize;
      const items = await db.objects
        .orderBy("createdAt")
        .offset(offset)
        .limit(pageSize)
        .toArray();

      return createPage(items, page, pageSize, totalItems);
    },
    count: async (): Promise<number> => {
      return LocalDatabase.getInstance().objects.count();
    },
  },
  sessions: {
    upsert: async (session: Session) => {
      const now = new Date();
      if (!session.createdAt) session.createdAt = now;
      session.updatedAt = now;
      await LocalDatabase.getInstance().sessions.put(session);
    },
    upsertMany: async (sessions: Session[]) => {
      const now = new Date();
      const updatedSessions = sessions.map((session) => ({
        ...session,
        createdAt: session.createdAt || now,
        updatedAt: now,
      }));
      await LocalDatabase.getInstance().sessions.bulkPut(updatedSessions);
    },
    read: async (id: string) => {
      return LocalDatabase.getInstance().sessions.get(id);
    },
    delete: async (id: string) => {
      const db = LocalDatabase.getInstance();
      // Use a transaction to ensure atomicity.
      // If deleting messages fails, the session won't be deleted either.
      await db.transaction("rw", db.sessions, db.messages, async () => {
        // Delete all messages associated with this session first
        await db.messages.where("sessionId").equals(id).delete();
        // Then delete the session itself
        await db.sessions.delete(id);
      });
    },
    getPage: async (page: number, pageSize: number): Promise<Page<Session>> => {
      const db = LocalDatabase.getInstance();
      const totalItems = await db.sessions.count();

      if (pageSize === -1) {
        const items = await db.sessions
          .orderBy("updatedAt")
          .reverse()
          .toArray();
        return createPage(items, page, pageSize, totalItems);
      }

      const offset = (page - 1) * pageSize;
      const items = await db.sessions
        .orderBy("updatedAt")
        .reverse()
        .offset(offset)
        .limit(pageSize)
        .toArray();

      return createPage(items, page, pageSize, totalItems);
    },
    count: async (): Promise<number> => {
      return LocalDatabase.getInstance().sessions.count();
    },
  },
  messages: {
    upsert: async (message: StreamableMessage) => {
      const now = new Date();
      if (!message.createdAt) message.createdAt = now;
      message.updatedAt = now;
      await LocalDatabase.getInstance().messages.put(message);
    },
    upsertMany: async (messages: StreamableMessage[]) => {
      const now = new Date();
      const updatedMessages = messages.map((msg) => ({
        ...msg,
        createdAt: msg.createdAt || now,
        updatedAt: now,
      }));
      await LocalDatabase.getInstance().messages.bulkPut(updatedMessages);
    },
    read: async (id: string) => {
      return LocalDatabase.getInstance().messages.get(id);
    },
    delete: async (id: string) => {
      await LocalDatabase.getInstance().messages.delete(id);
    },
    getPage: async (
      page: number,
      pageSize: number,
    ): Promise<Page<StreamableMessage>> => {
      const db = LocalDatabase.getInstance();
      // Note: This paginates ALL messages across ALL sessions.
      // For session-specific messages, see dbUtils.getMessagesPageForSession
      const totalItems = await db.messages.count();

      if (pageSize === -1) {
        const items = await db.messages.orderBy("createdAt").toArray();
        return createPage(items, page, pageSize, totalItems);
      }

      const offset = (page - 1) * pageSize;
      const items = await db.messages
        .orderBy("createdAt")
        .offset(offset)
        .limit(pageSize)
        .toArray();

      return createPage(items, page, pageSize, totalItems);
    },
    count: async (): Promise<number> => {
      return LocalDatabase.getInstance().messages.count();
    },
  },
};

// Expanded utility functions
export const dbUtils = {
  // --- Assistants ---
  getAllAssistants: async (): Promise<Assistant[]> => {
    return LocalDatabase.getInstance()
      .assistants.orderBy("createdAt")
      .toArray();
  },
  assistantExists: async (id: string): Promise<boolean> => {
    return (await LocalDatabase.getInstance().assistants.get(id)) !== undefined;
  },
  clearAllAssistants: async (): Promise<void> => {
    await LocalDatabase.getInstance().assistants.clear();
  },
  bulkUpsertAssistants: async (assistants: Assistant[]): Promise<void> => {
    await dbService.assistants.upsertMany(assistants);
  },

  // --- Objects ---
  getAllObjects: async (): Promise<DatabaseObject[]> => {
    return LocalDatabase.getInstance().objects.orderBy("createdAt").toArray();
  },
  objectExists: async (key: string): Promise<boolean> => {
    return (await LocalDatabase.getInstance().objects.get(key)) !== undefined;
  },
  clearAllObjects: async (): Promise<void> => {
    await LocalDatabase.getInstance().objects.clear();
  },
  bulkUpsertObjects: async (objects: DatabaseObject[]): Promise<void> => {
    await dbService.objects.upsertMany(objects);
  },

  // --- Sessions ---
  getAllSessions: async (): Promise<Session[]> => {
    return LocalDatabase.getInstance()
      .sessions.orderBy("updatedAt")
      .reverse()
      .toArray();
  },
  clearAllSessions: async (): Promise<void> => {
    await LocalDatabase.getInstance().sessions.clear();
    await LocalDatabase.getInstance().messages.clear(); // Also clear all messages
  },
  bulkUpsertSessions: async (sessions: Session[]): Promise<void> => {
    await dbService.sessions.upsertMany(sessions);
  },

  // --- Messages ---
  getAllMessages: async (): Promise<StreamableMessage[]> => {
    return LocalDatabase.getInstance().messages.orderBy("createdAt").toArray();
  },
  getAllMessagesForSession: async (
    sessionId: string,
  ): Promise<StreamableMessage[]> => {
    return LocalDatabase.getInstance()
      .messages.where("sessionId")
      .equals(sessionId)
      .sortBy("createdAt");
  },
  /**
   * NEW: Fetches a paginated list of messages for a specific session.
   * Fetches the most recent messages first and returns them in chronological order.
   */
  getMessagesPageForSession: async (
    sessionId: string,
    page: number,
    pageSize: number,
  ): Promise<Page<StreamableMessage>> => {
    const db = LocalDatabase.getInstance();
    const collection = db.messages.where({ sessionId });
    const totalItems = await collection.count();

    if (pageSize === -1) {
      const items = await collection.sortBy("createdAt");
      return createPage(items, 1, totalItems, totalItems);
    }

    // Fetch latest messages first for pagination purposes
    const items = await collection
      .reverse()
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .sortBy("createdAt");

    // Return the page's items in chronological order for display
    return createPage(items.reverse(), page, pageSize, totalItems);
  },
  deleteAllMessagesForSession: async (sessionId: string): Promise<number> => {
    return LocalDatabase.getInstance()
      .messages.where("sessionId")
      .equals(sessionId)
      .delete();
  },
  clearAllMessages: async (): Promise<void> => {
    await LocalDatabase.getInstance().messages.clear();
  },
  bulkUpsertMessages: async (messages: StreamableMessage[]): Promise<void> => {
    await dbService.messages.upsertMany(messages);
  },
};
