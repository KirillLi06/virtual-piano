import type { NoteCode } from "../../shared/types/NoteCode.type.js";
import type { TrackPianoEvent } from "../../shared/types/TrackEvent.type.js";
import type { TrackFile } from "../../shared/types/TrackFile.type.js";
import type { SoundSynthesizer } from "../audio/SoundSynthesizer.js";
import type { AirLogger } from "../logger/AirLogger.js";

export type PlaybackState = "idle" | "playing";

export interface TrackPlayerCallbacks {
  onStateChange?: (state: PlaybackState) => void;
  onNoteStart?: (note: NoteCode) => void;
  onNoteEnd?: (note: NoteCode) => void;
  onProgress?: (eventIndex: number, totalEvents: number) => void;
  onComplete?: (track: TrackFile) => void;
  onAbort?: (track: TrackFile) => void;
  onError?: (error: Error) => void;
}

interface ScheduledNote {
  readonly note: NoteCode;
  readonly startMs: number;
  readonly endMs: number;
}

interface TimelineAction {
  readonly timeMs: number;
  readonly type: "on" | "off";
  readonly note: NoteCode;
}

/**
 * Асинхронный полифонический проигрыватель треков с поддержкой немедленной отмены
 * через AbortController. Поддерживает как треки с явными временными метками
 * startTimeMs (аккорды и перекрытия), так и последовательные треки без startTimeMs.
 */
export class TrackPlayer {
  private readonly synthesizer: SoundSynthesizer;
  private readonly logger: AirLogger | undefined;
  private abortController: AbortController | null = null;
  private playing = false;

  constructor(synthesizer: SoundSynthesizer, logger?: AirLogger) {
    this.synthesizer = synthesizer;
    this.logger = logger;
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Запускает воспроизведение трека. Если уже идёт воспроизведение, предыдущее останавливается.
   */
  public async play(
    track: TrackFile,
    callbacks: TrackPlayerCallbacks = {},
  ): Promise<void> {
    if (this.playing) {
      this.stop();
    }

    if (track.events.length === 0) {
      this.logger?.warn(
        `Трек "${track.name}" не содержит событий для воспроизведения.`,
      );
      callbacks.onComplete?.(track);
      return;
    }

    const controller = new AbortController();
    this.abortController = controller;
    this.playing = true;
    callbacks.onStateChange?.("playing");
    this.logger?.info(
      `Воспроизведение трека "${track.name}" начато (событий: ${track.events.length})`,
    );

    const { signal } = controller;
    const activeNoteCounts = new Map<NoteCode, number>();

    try {
      const { actions, totalNotes, totalDurationMs } = buildTimeline(
        track.events,
      );

      if (actions.length === 0) {
        if (totalDurationMs > 0) {
          await abortableDelay(totalDurationMs, signal);
        }
      } else {
        const playbackOrigin = performance.now();
        let startedNotes = 0;

        for (const action of actions) {
          if (signal.aborted) {
            break;
          }

          const waitMs = action.timeMs - (performance.now() - playbackOrigin);
          if (waitMs > 0) {
            await abortableDelay(waitMs, signal);
          }

          if (signal.aborted) {
            break;
          }

          if (action.type === "on") {
            const count = activeNoteCounts.get(action.note) ?? 0;
            activeNoteCounts.set(action.note, count + 1);
            this.synthesizer.noteOn(action.note);
            callbacks.onNoteStart?.(action.note);
            startedNotes += 1;
            callbacks.onProgress?.(startedNotes, totalNotes);
          } else {
            const count = activeNoteCounts.get(action.note) ?? 0;
            if (count <= 1) {
              activeNoteCounts.delete(action.note);
              this.synthesizer.noteOff(action.note);
              callbacks.onNoteEnd?.(action.note);
            } else {
              activeNoteCounts.set(action.note, count - 1);
            }
          }
        }
      }

      if (signal.aborted) {
        this.logger?.info(
          `Воспроизведение трека "${track.name}" остановлено пользователем.`,
        );
        callbacks.onAbort?.(track);
      } else {
        this.logger?.info(`Воспроизведение трека "${track.name}" завершено.`);
        callbacks.onComplete?.(track);
      }
    } catch (err) {
      if (isAbortError(err)) {
        this.logger?.info(`Воспроизведение трека "${track.name}" остановлено.`);
        callbacks.onAbort?.(track);
      } else {
        const error = err instanceof Error ? err : new Error(String(err));
        this.logger?.error(`Ошибка воспроизведения трека: ${error.message}`);
        callbacks.onError?.(error);
      }
    } finally {
      for (const note of activeNoteCounts.keys()) {
        this.synthesizer.noteOff(note);
        callbacks.onNoteEnd?.(note);
      }
      activeNoteCounts.clear();
      this.synthesizer.stopAll();

      if (this.abortController === controller) {
        this.abortController = null;
        this.playing = false;
        callbacks.onStateChange?.("idle");
      }
    }
  }

  /** Немедленно прерывает текущее воспроизведение через AbortController. */
  public stop(): void {
    if (!this.playing || !this.abortController) {
      return;
    }
    this.abortController.abort();
    this.synthesizer.stopAll();
  }
}

/**
 * Преобразует список событий трека в отсортированную полифоническую очередь
 * микрособытий (включение/выключение нот). Если у ноты не задан startTimeMs,
 * она планируется последовательно после предыдущего курсора времени.
 */
function buildTimeline(events: readonly TrackPianoEvent[]): {
  actions: TimelineAction[];
  totalNotes: number;
  totalDurationMs: number;
} {
  const scheduledNotes: ScheduledNote[] = [];
  let cursorMs = 0;

  for (const event of events) {
    if (event.eventType === "pause") {
      cursorMs += event.durationMs;
      continue;
    }

    const startMs = event.startTimeMs ?? cursorMs;
    const endMs = startMs + event.durationMs;
    scheduledNotes.push({
      note: event.note,
      startMs,
      endMs,
    });
    cursorMs = Math.max(cursorMs, endMs);
  }

  const actions: TimelineAction[] = [];
  for (const item of scheduledNotes) {
    actions.push({ timeMs: item.startMs, type: "on", note: item.note });
    actions.push({ timeMs: item.endMs, type: "off", note: item.note });
  }

  // При совпадении времени сначала выполняем "off", затем "on",
  // чтобы повторное нажатие той же ноты без паузы корректно перезапускалось.
  actions.sort((a, b) => {
    if (a.timeMs !== b.timeMs) {
      return a.timeMs - b.timeMs;
    }
    if (a.type === b.type) {
      return 0;
    }
    return a.type === "off" ? -1 : 1;
  });

  return {
    actions,
    totalNotes: scheduledNotes.length,
    totalDurationMs: cursorMs,
  };
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(new DOMException("Playback aborted", "AbortError"));
  }

  return new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timerId);
      reject(new DOMException("Playback aborted", "AbortError"));
    };

    const timerId = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
