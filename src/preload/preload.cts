import { contextBridge, ipcRenderer } from "electron";
import type { ElectronAPI, SaveTrackPayload } from "../shared/ipc.js";

const electronAPI: ElectronAPI ={
    saveTrack: (payload: SaveTrackPayload) => ipcRenderer.invoke('save-track', payload),
    loadTrack: () => ipcRenderer.invoke('load-track'),
    
  appendLog: (line: string) => ipcRenderer.invoke('append-log', line)
} 

contextBridge.exposeInMainWorld('electronAPI', electronAPI)