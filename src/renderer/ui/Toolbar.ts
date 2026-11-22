import type { PianoController } from "../app/PianoController.js";
import type { TimbreType } from "../audio/SoundSynthesizer.js";
import type { TrackFormat } from "../recorder/TrackSerializer.js";

const TIMBRE_OPTIONS: readonly { value: TimbreType; label: string }[] = [
  { value: "periodic", label: "Пианино (PeriodicWave)" },
  { value: "sine", label: "Синус (sine)" },
  { value: "triangle", label: "Треугольник (triangle)" },
  { value: "square", label: "Меандр (square)" },
  { value: "sawtooth", label: "Пила (sawtooth)" },
];

/**
 * Панель управления (Toolbar):
 * запись/остановка записи, сохранение (JSON/TXT), открытие и воспроизведение,
 * остановка воспроизведения, ползунок Master Volume и выбор тембра.
 */
export class Toolbar {
  private readonly recordBtn: HTMLButtonElement;
  private readonly saveBtn: HTMLButtonElement;
  private readonly formatSelect: HTMLSelectElement;
  private readonly openPlayBtn: HTMLButtonElement;
  private readonly stopBtn: HTMLButtonElement;
  private readonly volumeInput: HTMLInputElement;
  private readonly volumeValue: HTMLSpanElement;
  private readonly timbreSelect: HTMLSelectElement;
  private readonly unsubscribe: () => void;

  constructor(container: HTMLElement, controller: PianoController) {
    container.innerHTML = "";

    // Группа 1: Запись и сохранение
    const recordGroup = document.createElement("div");
    recordGroup.className = "toolbar__group";

    this.recordBtn = createButton("● Запись", "btn btn--record");
    this.saveBtn = createButton("Сохранить", "btn");

    this.formatSelect = document.createElement("select");
    this.formatSelect.className = "toolbar__select toolbar__select--compact";
    this.formatSelect.setAttribute("aria-label", "Формат сохранения трека");
    this.formatSelect.append(
      new Option("JSON", "json"),
      new Option("TXT", "txt"),
    );

    recordGroup.append(this.recordBtn, this.formatSelect, this.saveBtn);

    // Группа 2: Воспроизведение
    const playGroup = document.createElement("div");
    playGroup.className = "toolbar__group";

    this.openPlayBtn = createButton(
      "▶ Открыть и воспроизвести",
      "btn btn--primary",
    );
    this.stopBtn = createButton("■ Стоп", "btn");

    playGroup.append(this.openPlayBtn, this.stopBtn);

    // Группа 3: Громкость и тембр
    const audioGroup = document.createElement("div");
    audioGroup.className = "toolbar__group toolbar__group--audio";

    const volumeLabel = document.createElement("label");
    volumeLabel.className = "toolbar__control";

    const volumeCaption = document.createElement("span");
    volumeCaption.textContent = "Громкость";

    this.volumeInput = document.createElement("input");
    this.volumeInput.type = "range";
    this.volumeInput.min = "0";
    this.volumeInput.max = "100";
    this.volumeInput.step = "1";
    this.volumeInput.value = String(
      Math.round(controller.synthesizer.getVolume() * 100),
    );
    this.volumeInput.className = "toolbar__range";

    this.volumeValue = document.createElement("span");
    this.volumeValue.className = "toolbar__value";
    this.volumeValue.textContent = `${this.volumeInput.value}%`;

    volumeLabel.append(volumeCaption, this.volumeInput, this.volumeValue);

    const timbreLabel = document.createElement("label");
    timbreLabel.className = "toolbar__control";

    const timbreCaption = document.createElement("span");
    timbreCaption.textContent = "Тембр";

    this.timbreSelect = document.createElement("select");
    this.timbreSelect.className = "toolbar__select";
    for (const opt of TIMBRE_OPTIONS) {
      this.timbreSelect.append(new Option(opt.label, opt.value));
    }
    this.timbreSelect.value = controller.synthesizer.getTimbre();

    timbreLabel.append(timbreCaption, this.timbreSelect);
    audioGroup.append(volumeLabel, timbreLabel);

    container.append(recordGroup, playGroup, audioGroup);

    // Обработчики событий
    this.recordBtn.addEventListener("click", () => {
      if (controller.recorder.isRecording()) {
        controller.stopRecording();
      } else {
        controller.startRecording();
      }
    });

    this.saveBtn.addEventListener("click", () => {
      const format: TrackFormat =
        this.formatSelect.value === "txt" ? "txt" : "json";
      void controller.saveRecording(format);
    });

    this.openPlayBtn.addEventListener("click", () => {
      void controller.loadAndPlayTrack();
    });

    this.stopBtn.addEventListener("click", () => {
      controller.stopPlayback();
    });

    this.volumeInput.addEventListener("input", () => {
      const percent = Number(this.volumeInput.value);
      this.volumeValue.textContent = `${percent}%`;
      controller.setVolume(percent / 100);
    });

    this.timbreSelect.addEventListener("change", () => {
      const selected = this.timbreSelect.value as TimbreType;
      controller.setTimbre(selected);
    });

    // Подписка на состояние (взаимная блокировка кнопок)
    this.unsubscribe = controller.subscribeState((state) => {
      const isRecording = state.mode === "recording";
      const isPlaying = state.mode === "playing";

      this.recordBtn.textContent = isRecording ? "■ Стоп записи" : "● Запись";
      this.recordBtn.classList.toggle("btn--recording-active", isRecording);
      this.recordBtn.disabled = isPlaying;

      this.saveBtn.disabled =
        isRecording || isPlaying || !state.hasRecordedTrack;
      this.formatSelect.disabled = isRecording || isPlaying;

      this.openPlayBtn.disabled = isRecording || isPlaying;
      this.stopBtn.disabled = !isPlaying;

      const volumePercent = String(Math.round(state.volume * 100));
      if (this.volumeInput.value !== volumePercent) {
        this.volumeInput.value = volumePercent;
        this.volumeValue.textContent = `${volumePercent}%`;
      }
      if (this.timbreSelect.value !== state.timbre) {
        this.timbreSelect.value = state.timbre;
      }
    });
  }

  public destroy(): void {
    this.unsubscribe();
  }
}

function createButton(text: string, className: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.textContent = text;
  return btn;
}
