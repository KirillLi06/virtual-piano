import {
  getFrequency,
  type NoteCode,
} from "../../shared/types/NoteCode.type.js";
import type { TrackPianoEvent } from "../../shared/types/TrackEvent.type.js";
import type { TrackFile } from "../../shared/types/TrackFile.type.js";
import type { AirLogger } from "../logger/AirLogger.js";

export interface TrackRecorderOptions {
  /** Минимальная длительность паузы в мс (сохранена для обратной совместимости опций). */
  minPauseMs?: number;
  /** Минимальная длительность ноты в мс (по умолчанию 20 мс). */
  minNoteDurationMs?: number;
  /** Логгер для фиксации событий записи. */
  logger?: AirLogger;
}

const DEFAULT_MIN_NOTE_DURATION_MS = 20;

/**
 * Модуль полифонической записи исполняемых мелодий.
 * Замеряет время старта (startTimeMs) и длительность (durationMs) каждой ноты
 * с высокой точностью через performance.now(), сохраняя аккорды и перекрытия.
 */
export class TrackRecorder {
  private readonly minNoteDurationMs: number;
  private readonly logger: AirLogger | undefined;

  private recording = false;
  private trackName = "";
  private events: TrackPianoEvent[] = [];
  private firstNoteTime: number | null = null;
  private readonly activeNoteStarts = new Map<NoteCode, number>();
  private lastCompletedTrack: TrackFile | null = null;

  constructor(options: TrackRecorderOptions = {}) {
    this.minNoteDurationMs =
      options.minNoteDurationMs ?? DEFAULT_MIN_NOTE_DURATION_MS;
    this.logger = options.logger;
  }

  public isRecording(): boolean {
    return this.recording;
  }

  public getEventCount(): number {
    return this.events.length;
  }

  public getLastTrack(): TrackFile | null {
    return this.lastCompletedTrack;
  }

  /** Начинает новую сессию записи трека. */
  public start(name?: string): void {
    if (this.recording) {
      this.logger?.warn("Запись уже запущена.");
      return;
    }

    this.recording = true;
    this.trackName = name?.trim() || buildDefaultTrackName(new Date());
    this.events = [];
    this.firstNoteTime = null;
    this.activeNoteStarts.clear();

    this.logger?.info(`Запись трека начата: "${this.trackName}"`);
  }

  /** Фиксирует момент нажатия ноты (поддерживает одновременные нажатия). */
  public recordNoteStart(note: NoteCode): void {
    if (!this.recording) {
      return;
    }

    if (this.activeNoteStarts.has(note)) {
      return;
    }

    const now = performance.now();
    if (this.firstNoteTime === null) {
      this.firstNoteTime = now;
    }

    this.activeNoteStarts.set(note, now);
  }

  /** Фиксирует момент отпускания ноты и добавляет TrackNoteEvent с startTimeMs и durationMs. */
  public recordNoteEnd(note: NoteCode): void {
    if (!this.recording) {
      return;
    }

    const startedAt = this.activeNoteStarts.get(note);
    if (startedAt === undefined) {
      return;
    }

    this.activeNoteStarts.delete(note);
    const now = performance.now();
    const origin = this.firstNoteTime ?? startedAt;
    const startTimeMs = Math.max(0, Math.round(startedAt - origin));
    const durationMs = Math.max(
      this.minNoteDurationMs,
      Math.round(now - startedAt),
    );

    this.events.push({
      eventType: "note",
      note,
      freq: getFrequency(note),
      durationMs,
      startTimeMs,
    });
  }

  /**
   * Завершает запись, закрывая все удерживаемые на момент остановки ноты,
   * сортирует события по времени старта и возвращает TrackFile.
   */
  public stop(): TrackFile {
    if (!this.recording) {
      if (this.lastCompletedTrack) {
        return this.lastCompletedTrack;
      }
      return {
        name: buildDefaultTrackName(new Date()),
        date: new Date().toISOString(),
        events: [],
      };
    }

    const now = performance.now();
    for (const [note, startedAt] of this.activeNoteStarts) {
      const origin = this.firstNoteTime ?? startedAt;
      const startTimeMs = Math.max(0, Math.round(startedAt - origin));
      const durationMs = Math.max(
        this.minNoteDurationMs,
        Math.round(now - startedAt),
      );
      this.events.push({
        eventType: "note",
        note,
        freq: getFrequency(note),
        durationMs,
        startTimeMs,
      });
    }

    this.events.sort((a, b) => {
      const startA = a.eventType === "note" ? (a.startTimeMs ?? 0) : 0;
      const startB = b.eventType === "note" ? (b.startTimeMs ?? 0) : 0;
      return startA - startB;
    });

    this.activeNoteStarts.clear();
    this.recording = false;
    this.firstNoteTime = null;

    const track: TrackFile = {
      name: this.trackName,
      date: new Date().toISOString(),
      events: [...this.events],
    };

    this.lastCompletedTrack = track;
    this.logger?.info(
      `Запись трека завершена: "${track.name}" (событий: ${track.events.length})`,
    );

    return track;
  }

  /** Сбрасывает текущую и последнюю сохранённую запись. */
  public reset(): void {
    this.recording = false;
    this.events = [];
    this.activeNoteStarts.clear();
    this.firstNoteTime = null;
    this.lastCompletedTrack = null;
  }
}

function buildDefaultTrackName(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
  return `track_${stamp}`;
}
