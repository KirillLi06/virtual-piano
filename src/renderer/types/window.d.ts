import type { ElectronAPI } from '../../shared/ipc.js';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}