export type LogLevel = "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
}
