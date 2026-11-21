import type { NoteCode } from '../../shared/types/NoteCode.type.js';
import type { TrackFile } from '../../shared/types/TrackFile.type.js';
import type { SoundSynthesizer } from '../audio/SoundSynthesizer.js';
import type { AirLogger } from '../logger/AirLogger.js';

export type PlaybackState = 'idle' | 'playing';

export interface TrackPlayerCallbacks {
  onStateChange?: (state: PlaybackState) => void;
  onNoteStart?: (note: NoteCode) => void;
  onNoteEnd?: (note: NoteCode) => void;
  onProgress?: (eventIndex: number, totalEvents: number) => void;
  onComplete?: (track: TrackFile) => void;
  onAbort?: (track: TrackFile) => void;
  onError?: (error: Error) => void;
}

/**
 * Асинхронный проигрыватель треков с поддержкой немедленной отмены через AbortController.
 * Синхронизирует звучание SoundSynthesizer с колбэками подсветки клавиш и строки статуса.
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
  public async play(track: TrackFile, callbacks: TrackPlayerCallbacks = {}): Promise<void> {
    if (this.playing) {
      this.stop();
    }

    if (track.events.length === 0) {
      this.logger?.warn(`Трек "${track.name}" не содержит событий для воспроизведения.`);
      callbacks.onComplete?.(track);
      return;
    }

    const controller = new AbortController();
    this.abortController = controller;
    this.playing = true;
    callbacks.onStateChange?.('playing');
    this.logger?.info(
      `Воспроизведение трека "${track.name}" начато (событий: ${track.events.length})`
    );

    const { signal } = controller;
    let activeNote: NoteCode | null = null;

    try {
      for (let i = 0; i < track.events.length; i++) {
        if (signal.aborted) {
          break;
        }

        const event = track.events[i];
        if (!event) {
          continue;
        }

        callbacks.onProgress?.(i + 1, track.events.length);

        if (event.eventType === 'note') {
          activeNote = event.note;
          this.synthesizer.noteOn(event.note);
          callbacks.onNoteStart?.(event.note);

          await abortableDelay(event.durationMs, signal);

          this.synthesizer.noteOff(event.note);
          callbacks.onNoteEnd?.(event.note);
          activeNote = null;
        } else {
          await abortableDelay(event.durationMs, signal);
        }
      }

      if (signal.aborted) {
        this.logger?.info(`Воспроизведение трека "${track.name}" остановлено пользователем.`);
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
      if (activeNote !== null) {
        this.synthesizer.noteOff(activeNote);
        callbacks.onNoteEnd?.(activeNote);
      }
      this.synthesizer.stopAll();

      if (this.abortController === controller) {
        this.abortController = null;
        this.playing = false;
        callbacks.onStateChange?.('idle');
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

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(new DOMException('Playback aborted', 'AbortError'));
  }

  return new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timerId);
      reject(new DOMException('Playback aborted', 'AbortError'));
    };

    const timerId = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}
