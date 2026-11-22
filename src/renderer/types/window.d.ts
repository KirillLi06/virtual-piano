import type { ElectronAPI } from "../../shared/ipc.js";
import type { PianoController } from "../app/PianoController.js";

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    /** Экземпляр ядра бизнес-логики для отладки и smoke-теста в DevTools до подключения UI. */
    pianoCore?: PianoController;
  }
}
