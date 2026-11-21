import { getFrequency, NOTES_MAP, type NoteCode } from '../../shared/types/NoteCode.type.js';
import type { AirLogger } from '../logger/AirLogger.js';

export type TimbreType = 'periodic' | 'sine' | 'square' | 'sawtooth' | 'triangle';

interface ActiveVoice {
  oscillator: OscillatorNode;
  gainNode: GainNode;
  startedAt: number;
  releasing: boolean;
}

export interface SoundSynthesizerOptions {
  /** Начальная громкость (0.0 – 1.0), по умолчанию 0.7. */
  initialVolume?: number;
  /** Начальный тембр, по умолчанию 'periodic' (3 гармоники 0.75 / 0.18 / 0.07). */
  initialTimbre?: TimbreType;
  /** Время атаки огибающей в секундах (по умолчанию 0.012 = 12 мс). */
  attackTimeSec?: number;
  /** Время затухания (релиза) в секундах (по умолчанию 0.025 = 25 мс). */
  releaseTimeSec?: number;
  /** Логгер для фиксации событий аудиоподсистемы. */
  logger?: AirLogger;
}

/**
 * Коэффициенты 3 гармоник для кастомного PeriodicWave (0.75 / 0.18 / 0.07).
 * Индекс 0 — постоянная составляющая (DC offset = 0).
 */
const HARMONIC_IMAG = new Float32Array([0, 0.75, 0.18, 0.07]);
const HARMONIC_REAL = new Float32Array([0, 0, 0, 0]);

/** Базовый уровень усиления одного голоса (запас по клиппингу при аккордах). */
const VOICE_PEAK_GAIN = 0.35;
const MIN_GAIN = 0.0001;

/**
 * Модуль синтеза звука на нативном Web Audio API.
 * Поддерживает полифонию (Map<NoteCode, ActiveVoice>), кастомный тембр PeriodicWave
 * с 3 гармониками (0.75 / 0.18 / 0.07), сглаживание ADSR (tA = 12 мс, tR = 25 мс)
 * и управление общей громкостью через Master GainNode.
 */
export class SoundSynthesizer {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private periodicWave: PeriodicWave | null = null;

  private readonly activeVoices = new Map<NoteCode, ActiveVoice>();
  private readonly attackTimeSec: number;
  private readonly releaseTimeSec: number;
  private readonly logger: AirLogger | undefined;

  private volume: number;
  private timbre: TimbreType;

  constructor(options: SoundSynthesizerOptions = {}) {
    this.volume = clampVolume(options.initialVolume ?? 0.7);
    this.timbre = options.initialTimbre ?? 'periodic';
    this.attackTimeSec = options.attackTimeSec ?? 0.012;
    this.releaseTimeSec = options.releaseTimeSec ?? 0.025;
    this.logger = options.logger;
  }

  /**
   * Лениво инициализирует AudioContext, Master GainNode и PeriodicWave.
   * Если контекст приостановлен политикой браузера, возобновляет его.
   */
  public ensureContext(): AudioContext {
    if (!this.audioContext) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.setValueAtTime(this.volume, ctx.currentTime);
      master.connect(ctx.destination);

      this.audioContext = ctx;
      this.masterGain = master;
      this.periodicWave = ctx.createPeriodicWave(HARMONIC_REAL, HARMONIC_IMAG, {
        disableNormalization: false,
      });

      this.logger?.info(
        `AudioContext инициализирован (sampleRate=${ctx.sampleRate} Гц, тембр=${this.timbre})`
      );
    }

    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume().catch((err: unknown) => {
        this.logger?.error(`Не удалось возобновить AudioContext: ${String(err)}`);
      });
    }

    return this.audioContext;
  }

  /** Включает звучание ноты (с плавной атакой tA = 12 мс). */
  public noteOn(note: NoteCode): void {
    const existing = this.activeVoices.get(note);
    if (existing && !existing.releasing) {
      // Нота уже звучит (например, автоповтор клавиши) — не плодим дубликаты голосов.
      return;
    }

    if (existing && existing.releasing) {
      this.forceStopVoice(existing);
      this.activeVoices.delete(note);
    }

    const ctx = this.ensureContext();
    const master = this.masterGain;
    if (!master) {
      return;
    }

    const frequency = getFrequency(note);
    const now = ctx.currentTime;

    const oscillator = ctx.createOscillator();
    oscillator.frequency.setValueAtTime(frequency, now);
    this.applyTimbre(oscillator);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(MIN_GAIN, now);
    gainNode.gain.linearRampToValueAtTime(VOICE_PEAK_GAIN, now + this.attackTimeSec);

    oscillator.connect(gainNode);
    gainNode.connect(master);

    const voice: ActiveVoice = {
      oscillator,
      gainNode,
      startedAt: now,
      releasing: false,
    };

    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
      if (this.activeVoices.get(note) === voice) {
        this.activeVoices.delete(note);
      }
    };

    oscillator.start(now);
    this.activeVoices.set(note, voice);

    const label = NOTES_MAP.get(note)?.labelRu ?? note;
    this.logger?.info(`Нота нажата: ${label} (${note}, ${frequency} Гц)`);
  }

  /** Плавно останавливает звучание ноты (релиз tR = 25 мс без щелчков). */
  public noteOff(note: NoteCode): void {
    const voice = this.activeVoices.get(note);
    if (!voice || voice.releasing || !this.audioContext) {
      return;
    }

    voice.releasing = true;
    const now = this.audioContext.currentTime;
    const gainParam = voice.gainNode.gain;

    gainParam.cancelScheduledValues(now);
    const currentGain = Math.max(gainParam.value, MIN_GAIN);
    gainParam.setValueAtTime(currentGain, now);
    gainParam.linearRampToValueAtTime(0, now + this.releaseTimeSec);

    try {
      voice.oscillator.stop(now + this.releaseTimeSec + 0.005);
    } catch {
      // Осциллятор уже мог быть остановлен.
    }
  }

  /** Останавливает все активные ноты (используется при «Стоп» или потере фокуса окна). */
  public stopAll(): void {
    for (const note of [...this.activeVoices.keys()]) {
      this.noteOff(note);
    }
  }

  /** Возвращает список активных в данный момент нот. */
  public getActiveNotes(): NoteCode[] {
    const result: NoteCode[] = [];
    for (const [note, voice] of this.activeVoices) {
      if (!voice.releasing) {
        result.push(note);
      }
    }
    return result;
  }

  /** Устанавливает общую громкость в диапазоне [0.0, 1.0]. */
  public setVolume(value: number): void {
    this.volume = clampVolume(value);
    if (this.audioContext && this.masterGain) {
      const now = this.audioContext.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.volume, now, 0.01);
    }
    this.logger?.info(`Громкость изменена: ${Math.round(this.volume * 100)}%`);
  }

  public getVolume(): number {
    return this.volume;
  }

  /** Переключает тембр для всех последующих (и активных) нот. */
  public setTimbre(timbre: TimbreType): void {
    this.timbre = timbre;
    for (const voice of this.activeVoices.values()) {
      if (!voice.releasing) {
        this.applyTimbre(voice.oscillator);
      }
    }
    this.logger?.info(`Тембр переключён на: ${timbre}`);
  }

  public getTimbre(): TimbreType {
    return this.timbre;
  }

  /** Освобождает ресурсы AudioContext при закрытии приложения. */
  public async dispose(): Promise<void> {
    this.stopAll();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }
    this.audioContext = null;
    this.masterGain = null;
    this.periodicWave = null;
    this.activeVoices.clear();
  }

  private applyTimbre(oscillator: OscillatorNode): void {
    if (this.timbre === 'periodic' && this.periodicWave) {
      oscillator.setPeriodicWave(this.periodicWave);
    } else if (this.timbre !== 'periodic') {
      oscillator.type = this.timbre;
    }
  }

  private forceStopVoice(voice: ActiveVoice): void {
    try {
      voice.oscillator.stop();
      voice.oscillator.disconnect();
      voice.gainNode.disconnect();
    } catch {
      // Игнорируем, если узел уже остановлен.
    }
  }
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.7;
  }
  return Math.min(1, Math.max(0, value));
}
