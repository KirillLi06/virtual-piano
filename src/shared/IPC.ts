export const IPC_CHANNELS = {
  SAVE_TRACK: 'save-track',
  LOAD_TRACK: 'load-track',
  APPEND_LOG: 'append-log',
} as const;

export interface SaveTrackPayload {
  content: string;
  defaultFileName?: string;
}

export interface SaveTrackResult {
  canceled: boolean;
  filePath?: string;
  error?: string;
}

export interface LoadTrackResult {
  canceled: boolean;
  filePath?: string;
  fileName?: string;
  content?: string;
  error?: string;
}

export interface ElectronAPI {
  saveTrack: (payload: SaveTrackPayload) => Promise<SaveTrackResult>;
  loadTrack: () => Promise<LoadTrackResult>;
  appendLog: (line: string) => Promise<void>;
}