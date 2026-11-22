import type { LoadTrackResult, SaveTrackResult } from "../../shared/ipc.js";
import type { NoteCode } from "../../shared/types/NoteCode.type.js";
import type { TrackFile } from "../../shared/types/TrackFile.type.js";
import {
  SoundSynthesizer,
  type TimbreType,
} from "../audio/SoundSynthesizer.js";
import { AirLogger } from "../logger/AirLogger.js";
import { parseTrack, TrackParseError } from "../player/TrackParser.js";
import { TrackPlayer } from "../player/TrackPlayer.js";
import { TrackRecorder } from "../recorder/TrackRecorder.js";
import {
  buildDefaultTrackFileName,
  serializeTrack,
  type TrackFormat,
} from "../recorder/TrackSerializer.js";

export type AppMode = "ready" | "recording" | "playing" | "error";

export interface AppStateSnapshot {
  readonly mode: AppMode;
  readonly activeNotes: readonly NoteCode[];
  readonly currentTrackName: string | null;
  readonly currentEventCount: number;
  readonly hasRecordedTrack: boolean;
  readonly volume: number;
  readonly timbre: TimbreType;
  readonly lastError: string | null;
}

export type StateListener = (state: AppStateSnapshot) => void;

/**
 * Единый фасад бизнес-логики (ядро Renderer Process).
 * Координирует SoundSynthesizer, TrackRecorder, TrackPlayer, AirLogger и IPC-мост electronAPI.
 * UI-компоненты (клавиатура, панель управления, LogPanel, StatusBar) подключаются к этому классу.
 */
export class PianoController {
  public readonly logger: AirLogger;
  public readonly synthesizer: SoundSynthesizer;
  public readonly recorder: TrackRecorder;
  public readonly player: TrackPlayer;

  private mode: AppMode = "ready";
  private currentTrackName: string | null = null;
  private currentEventCount = 0;
  private lastError: string | null = null;

  private readonly activeNotes = new Set<NoteCode>();
  private readonly stateListeners = new Set<StateListener>();

  constructor() {
    this.logger = new AirLogger();
    this.synthesizer = new SoundSynthesizer({ logger: this.logger });
    this.recorder = new TrackRecorder({ logger: this.logger });
    this.player = new TrackPlayer(this.synthesizer, this.logger);

    this.logger.info("Ядро приложения «Виртуальное пианино» инициализировано.");
  }

  /** Возвращает снимок текущего состояния приложения для обновления UI. */
  public getState(): AppStateSnapshot {
    return {
      mode: this.mode,
      activeNotes: [...this.activeNotes],
      currentTrackName: this.currentTrackName,
      currentEventCount: this.currentEventCount,
      hasRecordedTrack: (this.recorder.getLastTrack()?.events.length ?? 0) > 0,
      volume: this.synthesizer.getVolume(),
      timbre: this.synthesizer.getTimbre(),
      lastError: this.lastError,
    };
  }

  /** Подписка UI-компонентов (StatusBar, Toolbar, PianoKeyboard) на изменения состояния. */
  public subscribeState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /** Нажатие клавиши пользователем (мышью или с физической клавиатуры). */
  public pressNote(note: NoteCode): void {
    if (this.player.isPlaying()) {
      return;
    }
    if (this.activeNotes.has(note)) {
      return;
    }

    this.activeNotes.add(note);
    this.synthesizer.noteOn(note);

    if (this.recorder.isRecording()) {
      this.recorder.recordNoteStart(note);
    }

    this.emitState();
  }

  /** Отпускание клавиши пользователем. */
  public releaseNote(note: NoteCode): void {
    if (!this.activeNotes.has(note)) {
      return;
    }

    this.activeNotes.delete(note);
    this.synthesizer.noteOff(note);

    if (this.recorder.isRecording()) {
      this.recorder.recordNoteEnd(note);
      this.currentEventCount = this.recorder.getEventCount();
    }

    this.emitState();
  }

  /** Отпускает все нажатые клавиши (например, при потере фокуса окна). */
  public releaseAllNotes(): void {
    for (const note of [...this.activeNotes]) {
      this.releaseNote(note);
    }
    this.synthesizer.stopAll();
  }

  /** Запускает запись нового трека (заблокировано во время воспроизведения). */
  public startRecording(trackName?: string): boolean {
    if (this.player.isPlaying()) {
      this.logger.warn("Невозможно начать запись во время воспроизведения.");
      return false;
    }
    if (this.recorder.isRecording()) {
      return false;
    }

    this.lastError = null;
    this.recorder.start(trackName);
    this.mode = "recording";
    this.currentEventCount = 0;
    this.emitState();
    return true;
  }

  /** Останавливает запись и сохраняет результат в памяти до вызова saveRecording(). */
  public stopRecording(): TrackFile | null {
    if (!this.recorder.isRecording()) {
      return null;
    }

    this.releaseAllNotes();
    const track = this.recorder.stop();
    this.mode = "ready";
    this.currentTrackName = track.name;
    this.currentEventCount = track.events.length;
    this.emitState();
    return track;
  }

  /** Сохраняет последний записанный трек на диск через IPC-диалог. */
  public async saveRecording(
    format: TrackFormat = "json",
  ): Promise<SaveTrackResult> {
    const track = this.recorder.getLastTrack();
    if (!track || track.events.length === 0) {
      const msg = "Нет записанных событий для сохранения.";
      this.logger.warn(msg);
      return { canceled: true, error: msg };
    }

    const content = serializeTrack(track, format);
    const defaultFileName = buildDefaultTrackFileName(track.name, format);

    const result = await window.electronAPI.saveTrack({
      content,
      defaultFileName,
    });

    if (result.error) {
      this.setError(`Ошибка сохранения файла: ${result.error}`);
    } else if (result.canceled) {
      this.logger.info("Сохранение трека отменено пользователем.");
    } else if (result.filePath) {
      this.logger.info(`Трек сохранён: ${result.filePath}`);
    }

    return result;
  }

  /** Открывает диалог выбора файла трека, валидирует его и запускает воспроизведение. */
  public async loadAndPlayTrack(): Promise<LoadTrackResult> {
    if (this.recorder.isRecording()) {
      this.logger.warn("Остановите запись перед загрузкой трека.");
      return { canceled: true };
    }

    const result = await window.electronAPI.loadTrack();

    if (result.error) {
      this.setError(`Ошибка чтения файла: ${result.error}`);
      return result;
    }
    if (result.canceled || result.content === undefined) {
      this.logger.info("Загрузка трека отменена пользователем.");
      return result;
    }

    try {
      const track = parseTrack(result.content, result.fileName);
      this.currentTrackName = result.fileName ?? track.name;
      this.currentEventCount = track.events.length;
      this.lastError = null;
      this.emitState();

      await this.playTrack(track);
    } catch (err) {
      const msg =
        err instanceof TrackParseError
          ? `Ошибка формата трека: ${err.message}`
          : `Не удалось загрузить трек: ${String(err)}`;
      this.setError(msg);
    }

    return result;
  }

  /** Воспроизводит уже распарсенный объект TrackFile. */
  public async playTrack(track: TrackFile): Promise<void> {
    if (this.recorder.isRecording()) {
      this.logger.warn("Невозможно воспроизводить трек во время записи.");
      return;
    }

    this.releaseAllNotes();
    this.currentTrackName = track.name;
    this.currentEventCount = track.events.length;
    this.lastError = null;

    await this.player.play(track, {
      onStateChange: (state) => {
        this.mode = state === "playing" ? "playing" : "ready";
        this.emitState();
      },
      onNoteStart: (note) => {
        this.activeNotes.add(note);
        this.emitState();
      },
      onNoteEnd: (note) => {
        this.activeNotes.delete(note);
        this.emitState();
      },
      onError: (err) => {
        this.setError(`Ошибка воспроизведения: ${err.message}`);
      },
    });
  }

  /** Останавливает воспроизведение трека. */
  public stopPlayback(): void {
    this.player.stop();
    this.activeNotes.clear();
    if (this.mode === "playing") {
      this.mode = "ready";
    }
    this.emitState();
  }

  public setVolume(value: number): void {
    this.synthesizer.setVolume(value);
    this.emitState();
  }

  public setTimbre(timbre: TimbreType): void {
    this.synthesizer.setTimbre(timbre);
    this.emitState();
  }

  public async dispose(): Promise<void> {
    this.stopPlayback();
    this.releaseAllNotes();
    await this.synthesizer.dispose();
  }

  private setError(message: string): void {
    this.lastError = message;
    this.mode = "error";
    this.logger.error(message);
    this.emitState();
  }

  private emitState(): void {
    const snapshot = this.getState();
    for (const listener of this.stateListeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error("PianoController state listener error:", err);
      }
    }
  }
}
