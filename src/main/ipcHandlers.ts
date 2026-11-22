import {
  ipcMain,
  dialog,
  BrowserWindow,
  type IpcMainInvokeEvent,
  type OpenDialogOptions,
  type SaveDialogOptions,
  app,
} from "electron";
import { writeFile, readFile, appendFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  IPC_CHANNELS,
  type SaveTrackPayload,
  type SaveTrackResult,
  type LoadTrackResult,
} from "../shared/ipc.js";

const TRACK_FILTERS = [
  { name: "JSON треки", extensions: ["json"] },
  { name: "Текстовые треки", extensions: ["txt"] },
];

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SAVE_TRACK, handleSaveTrack);
  ipcMain.handle(IPC_CHANNELS.LOAD_TRACK, handleLoadTrack);
  ipcMain.handle(IPC_CHANNELS.APPEND_LOG, handleAppendLog);
  ipcMain.handle(IPC_CHANNELS.CLEAR_LOG, handleClearLog);
}

async function handleSaveTrack(
  event: IpcMainInvokeEvent,
  payload: SaveTrackPayload,
): Promise<SaveTrackResult> {
  const win = BrowserWindow.fromWebContents(event.sender);
  const options: SaveDialogOptions = {
    filters: TRACK_FILTERS,
    ...(payload.defaultFileName
      ? { defaultPath: payload.defaultFileName }
      : {}),
  };

  const { canceled, filePath } = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options);

  if (canceled || !filePath) {
    return { canceled: true };
  }

  try {
    await writeFile(filePath, payload.content, "utf-8");
    return { canceled: false, filePath };
  } catch (error) {
    console.error("Failed to save track:", error);
    return { canceled: false, error: String(error) };
  }
}

async function handleLoadTrack(
  event: IpcMainInvokeEvent,
): Promise<LoadTrackResult> {
  const win = BrowserWindow.fromWebContents(event.sender);
  const options: OpenDialogOptions = {
    filters: TRACK_FILTERS,
    properties: ["openFile"],
  };

  const { canceled, filePaths } = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);

  const filePath = filePaths[0];
  if (canceled || !filePath) {
    return { canceled: true };
  }

  try {
    const content = await readFile(filePath, "utf-8");
    return {
      canceled: false,
      filePath,
      fileName: basename(filePath),
      content,
    };
  } catch (error) {
    console.error("Failed to load track:", error);
    return { canceled: false, error: String(error) };
  }
}

async function handleClearLog(): Promise<void> {
  try {
    await writeFile(getLogFilePath(), "", "utf-8");
  } catch (error) {
    console.error("Failed to clear log:", error);
  }
}

function getLogFilePath(): string {
  const dir = app.isPackaged ? app.getPath("userData") : process.cwd();
  return join(dir, "app_log.txt");
}

async function handleAppendLog(
  _event: IpcMainInvokeEvent,
  line: string,
): Promise<void> {
  try {
    await appendFile(getLogFilePath(), `${line}\n`, "utf-8");
  } catch (error) {
    console.error("Failed to append log:", error);
  }
}
