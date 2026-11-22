import { NOTES_MAP, type NoteCode } from "../../shared/index.js";
import type { AppMode, PianoController } from "../app/PianoController.js";

const MODE_LABELS: Record<AppMode, string> = {
  ready: "Готов",
  recording: "Идёт запись",
  playing: "Воспроизведение",
  error: "Ошибка",
};

/**
 * Строка состояния (StatusBar):
 * отображает режим работы, активные ноты с частотой, имя трека и число событий.
 */
export class StatusBar {
  private readonly modeEl: HTMLSpanElement;
  private readonly noteEl: HTMLSpanElement;
  private readonly trackEl: HTMLSpanElement;
  private readonly unsubscribe: () => void;

  constructor(container: HTMLElement, controller: PianoController) {
    container.innerHTML = "";

    this.modeEl = document.createElement("span");
    this.modeEl.className = "status-bar__item status-bar__mode";

    this.noteEl = document.createElement("span");
    this.noteEl.className = "status-bar__item status-bar__note";

    this.trackEl = document.createElement("span");
    this.trackEl.className = "status-bar__item status-bar__track";

    container.append(this.modeEl, this.noteEl, this.trackEl);

    this.unsubscribe = controller.subscribeState((state) => {
      this.modeEl.textContent = state.lastError
        ? `${MODE_LABELS[state.mode]}: ${state.lastError}`
        : `Режим: ${MODE_LABELS[state.mode]}`;
      this.modeEl.dataset["mode"] = state.mode;

      this.noteEl.textContent = formatActiveNotes(state.activeNotes);

      const trackLabel = state.currentTrackName ?? "—";
      this.trackEl.textContent = `Трек: ${trackLabel} (событий: ${state.currentEventCount})`;
    });
  }

  public destroy(): void {
    this.unsubscribe();
  }
}

function formatActiveNotes(notes: readonly NoteCode[]): string {
  if (notes.length === 0) {
    return "Нота: —";
  }
  const formatted = notes.map((code) => {
    const info = NOTES_MAP.get(code);
    return info
      ? `${info.labelRu} (${info.code} · ${info.frequency} Гц)`
      : code;
  });
  return `Нота: ${formatted.join(", ")}`;
}
