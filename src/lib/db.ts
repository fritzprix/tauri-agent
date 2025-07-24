import Dexie, { Table } from "dexie";

// --- TYPE DEFINITIONS ---
// These types are used within the application logic.
export interface Assistant {
  id: string;
  name: string;
  systemPrompt: string;
  mcpConfig: {
    mcpServers?: Record<
      string,
      {
        command: string;
        args?: string[];
        env?: Record<string, string>;
      }
    >;
  };
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Setting {
  key: string;
  value: any;
}

class MCPAgentDB extends Dexie {
  assistants!: Table<Assistant, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super("MCPAgentDB");
    this.version(1).stores({
      assistants: "&id", // Primary key 'id'
      settings: "&key", // Primary key 'key'
    });
  }
}

class DBService {
  private static instance: DBService;
  private db: MCPAgentDB;

  private constructor() {
    this.db = new MCPAgentDB();
  }

  public static getInstance(): DBService {
    if (!DBService.instance) {
      DBService.instance = new DBService();
    }
    return DBService.instance;
  }

  /**
   * Create a new assistant. Fails if the assistant already exists.
   */
  public async createAssistant(assistant: Assistant): Promise<void> {
    try {
      await this.db.assistants.add(assistant);
    } catch (error) {
      if (error instanceof Dexie.ConstraintError) {
        throw new Error("Assistant already exists");
      }
      throw error;
    }
  }

  /**
   * Get a single assistant by id.
   */
  public async getAssistant(id: string): Promise<Assistant | null> {
    const assistant = await this.db.assistants.get(id);
    return assistant || null;
  }

  /**
   * Upsert an assistant (insert or update).
   */
  public async upsertAssistant(assistant: Assistant): Promise<void> {
    await this.db.assistants.put(assistant);
  }

  /**
   * Get all assistants.
   */
  public async getAssistants(): Promise<Assistant[]> {
    return this.db.assistants.toArray();
  }

  /**
   * Delete an assistant by id.
   */
  public async deleteAssistant(id: string): Promise<void> {
    await this.db.assistants.delete(id);
  }

  /**
   * Save a setting.
   */
  public async saveSetting(key: string, value: any): Promise<void> {
    await this.db.settings.put({ key, value });
  }

  /**
   * Get a setting by key.
   */
  public async getSetting<T>(key: string): Promise<T | null> {
    const setting = await this.db.settings.get(key);
    return setting ? (setting.value as T) : null;
  }
}

export const dbService = DBService.getInstance();
