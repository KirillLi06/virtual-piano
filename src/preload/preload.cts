import { contextBridge, ContextBridge, ipcRenderer } from "electron";
import type { ElectronAPI, SaveTrackPayload, SaveTrackResult, LoadTrackResult } from "../shared/ipc";

const electronAPI: ElectronAPI ={
    saveTrack: (payload: SaveTrackPayload) => ipcRenderer.invoke('save-track', payload),
    loadTrack: () => ipcRenderer.invoke('load-track'),
    
  appendLog: (line: string) => ipcRenderer.invoke('append-log')
} 

contextBridge.exposeInMainWorld('electronAPI', electronAPI)