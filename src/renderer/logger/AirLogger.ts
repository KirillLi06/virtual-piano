import type { LogEntry, LogLevel } from "../../shared/types/LogLevel.type.js";

export type LogListener = (entry: LogEntry) => void;
export type LogClearListener = () => void;

export interface AirLoggerOptions {
  maxEntries?: number;
  echoToConsole?: boolean;
}

const DEFAULT_MAX_ENTRIES = 500;

export class AirLogger {
  private readonly maxEntries: number;
  private readonly echoToConsole: boolean;
  private entries: LogEntry[] = [];
  private readonly listeners = new Set<LogListener>();
  private readonly clearListeners = new Set<LogClearListener>();

  constructor(options: AirLoggerOptions = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.echoToConsole = options.echoToConsole ?? true;
  }

  public log(level: LogLevel, message: string): LogEntry {
    const entry: LogEntry = {
      timestamp: formatTimestamp(new Date()),
      level,
      message,
    };

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch (err) {
        console.error("AirLogger listener error:", err);
      }
    }

    const formattedLine = AirLogger.formatLine(entry);

    if (this.echoToConsole) {
      this.writeToConsole(level, formattedLine);
    }

    this.persistLine(formattedLine);

    return entry;
  }

  public info(message: string): LogEntry {
    return this.log("INFO", message);
  }

  public warn(message: string): LogEntry {
    return this.log("WARN", message);
  }

  public error(message: string): LogEntry {
    return this.log("ERROR", message);
  }

  /** Возвращает снимок текущих записей в памяти (для первичной отрисовки LogPanel). */
  public getEntries(): readonly LogEntry[] {
    return [...this.entries];
  }

  /** Очищает экранный буфер журнала (файл app_log.txt на диске сохраняется). */
  public clear(): void {
    this.entries = [];
    for (const listener of this.clearListeners) {
      try {
        listener();
      } catch (err) {
        console.error("AirLogger clear listener error:", err);
      }
    }
  }
  public async clearAll(): Promise<void> {
    this.clear();
    const api = typeof window !== "undefined" ? window.electronAPI : undefined;
    if (!api) {
      return;
    }
    try {
      await api.clearLog();
    } catch (err) {
      console.error("AirLogger IPC clearLog failed:", err);
    }
  }

  /** Подписка на новые записи журнала; возвращает функцию отписки. */
  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Подписка на очистку экранного журнала; возвращает функцию отписки. */
  public onClear(listener: LogClearListener): () => void {
    this.clearListeners.add(listener);
    return () => {
      this.clearListeners.delete(listener);
    };
  }

  public static formatLine(entry: LogEntry): string {
    return `[${entry.timestamp}] [${entry.level}] ${entry.message}`;
  }

  private writeToConsole(level: LogLevel, line: string): void {
    switch (level) {
      case "INFO":
        console.info(line);
        break;
      case "WARN":
        console.warn(line);
        break;
      case "ERROR":
        console.error(line);
        break;
    }
  }

  private persistLine(line: string): void {
    const api = typeof window !== "undefined" ? window.electronAPI : undefined;
    if (!api) {
      return;
    }
    void api.appendLog(line).catch((err: unknown) => {
      console.error("AirLogger IPC appendLog failed:", err);
    });
  }
}

function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}
