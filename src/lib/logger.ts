import { debug, info, warn, error as logError, trace } from '@tauri-apps/plugin-log';

export class Logger {
  private static context = 'TauriAgent';

  static async debug(message: string, context?: string): Promise<void> {
    await debug(`[${context || this.context}] ${message}`);
  }

  static async info(message: string, context?: string): Promise<void> {
    await info(`[${context || this.context}] ${message}`);
  }

  static async warn(message: string, context?: string): Promise<void> {
    await warn(`[${context || this.context}] ${message}`);
  }

  static async error(message: string, context?: string, error?: Error): Promise<void> {
    const errorMsg = error ? `${message}: ${error.message}` : message;
    await logError(`[${context || this.context}] ${errorMsg}`);
  }

  static async trace(message: string, context?: string): Promise<void> {
    await trace(`[${context || this.context}] ${message}`);
  }
}

// Convenience functions for common logging patterns
export const log = {
  debug: (message: string, context?: string) => Logger.debug(message, context),
  info: (message: string, context?: string) => Logger.info(message, context),
  warn: (message: string, context?: string) => Logger.warn(message, context),
  error: (message: string, context?: string, error?: Error) => Logger.error(message, context, error),
  trace: (message: string, context?: string) => Logger.trace(message, context),
};
