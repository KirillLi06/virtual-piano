import { getFrequency, type NoteCode } from '../../shared/types/NoteCode.type.js';
import type { TrackPianoEvent } from '../../shared/types/TrackEvent.type.js';
import type { TrackFile } from '../../shared/types/TrackFile.type.js';
import type { AirLogger } from '../logger/AirLogger.js';

export interface TrackRecorderOptions {
  /** Минимальная длительность паузы в мс, ниже которой пауза не записывается (по умолчанию 15 мс). */
  minPauseMs?: number;
  /** Минимальная длительность ноты в мс (по умолчанию 20 мс). */
  minNoteDurationMs?: number;
  /** Логгер для фиксации событий записи. */
  logger?: AirLogger;
}

const DEFAULT_MIN_PAUSE_MS = 15;
const DEFAULT_MIN_NOTE_DURATION_MS = 20;

/**
 * Модуль записи исполняемых мелодий.
 * Замеряет длительности нот и пауз с высокой точностью через performance.now().
 */
export class TrackRecorder {
  private readonly minPauseMs: number;
  private readonly minNoteDurationMs: number;
  private readonly logger: AirLogger | undefined;

  private recording = false;
  private trackName = '';
  private events: TrackPianoEvent[] = [];
  private lastEventEndTime: number | null = null;
  private readonly activeNoteStarts = new Map<NoteCode, number>();
  private lastCompletedTrack: TrackFile | null = null;

  constructor(options: TrackRecorderOptions = {}) {
    this.minPauseMs = options.minPauseMs ?? DEFAULT_MIN_PAUSE_MS;
    this.minNoteDurationMs = options.minNoteDurationMs ?? DEFAULT_MIN_NOTE_DURATION_MS;
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
      this.logger?.warn('Запись уже запущена.');
      return;
    }

    this.recording = true;
    this.trackName = name?.trim() || buildDefaultTrackName(new Date());
    this.events = [];
    this.lastEventEndTime = null;
    this.activeNoteStarts.clear();

    this.logger?.info(`Запись трека начата: "${this.trackName}"`);
  }

  /** Фиксирует момент нажатия ноты (и предшествующую паузу, если она была). */
  public recordNoteStart(note: NoteCode): void {
    if (!this.recording) {
      return;
    }

    if (this.activeNoteStarts.has(note)) {
      return;
    }

    const now = performance.now();

    if (this.lastEventEndTime !== null && this.activeNoteStarts.size === 0) {
      const pauseMs = Math.round(now - this.lastEventEndTime);
      if (pauseMs >= this.minPauseMs) {
        this.events.push({
          eventType: 'pause',
          durationMs: pauseMs,
        });
      }
    }

    this.activeNoteStarts.set(note, now);
  }

  /** Фиксирует момент отпускания ноты и добавляет TrackNoteEvent с вычисленной длительностью. */
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
    const durationMs = Math.max(this.minNoteDurationMs, Math.round(now - startedAt));

    this.events.push({
      eventType: 'note',
      note,
      freq: getFrequency(note),
      durationMs,
    });

    this.lastEventEndTime = now;
  }

  /**
   * Завершает запись, закрывая все удерживаемые на момент остановки ноты,
   * и возвращает сформированный объект TrackFile.
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
      const durationMs = Math.max(this.minNoteDurationMs, Math.round(now - startedAt));
      this.events.push({
        eventType: 'note',
        note,
        freq: getFrequency(note),
        durationMs,
      });
    }

    this.activeNoteStarts.clear();
    this.recording = false;
    this.lastEventEndTime = null;

    const track: TrackFile = {
      name: this.trackName,
      date: new Date().toISOString(),
      events: [...this.events],
    };

    this.lastCompletedTrack = track;
    this.logger?.info(
      `Запись трека завершена: "${track.name}" (событий: ${track.events.length})`
    );

    return track;
  }

  /** Сбрасывает текущую и последнюю сохранённую запись. */
  public reset(): void {
    this.recording = false;
    this.events = [];
    this.activeNoteStarts.clear();
    this.lastEventEndTime = null;
    this.lastCompletedTrack = null;
  }
}

function buildDefaultTrackName(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
  return `track_${stamp}`;
}
