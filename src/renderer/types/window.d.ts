import type { ElectronAPI } from '../../shared/ipc.ts';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}