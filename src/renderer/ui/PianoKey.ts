import type { NoteCode, NoteInfo } from "../../shared/types/NoteCode.type.js";

export interface PianoKeyCallbacks {
  onPress: (note: NoteCode) => void;
  onRelease: (note: NoteCode) => void;
}

/**
 * UI-компонент одной клавиши виртуального пианино.
 * Отвечает за DOM-разметку, pointer-события и визуальное состояние .active.
 */
export class PianoKey {
  public readonly element: HTMLButtonElement;
  public readonly note: NoteCode;

  constructor(info: NoteInfo, callbacks: PianoKeyCallbacks) {
    this.note = info.code;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "piano-key";
    btn.dataset["note"] = info.code;
    btn.setAttribute(
      "aria-label",
      `${info.labelRu} (${info.code}, ${info.frequency} Гц)`,
    );

    const labelSpan = document.createElement("span");
    labelSpan.className = "piano-key__label";
    labelSpan.textContent = info.labelRu;

    const codeSpan = document.createElement("span");
    codeSpan.className = "piano-key__code";
    codeSpan.textContent = `${info.code} · ${info.frequency} Гц`;

    const hintSpan = document.createElement("span");
    hintSpan.className = "piano-key__hint";
    hintSpan.textContent = info.keyHint;

    btn.append(labelSpan, codeSpan, hintSpan);

    btn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      callbacks.onPress(info.code);
    });
    btn.addEventListener("pointerup", () => callbacks.onRelease(info.code));
    btn.addEventListener("pointerleave", () => callbacks.onRelease(info.code));
    btn.addEventListener("pointercancel", () => callbacks.onRelease(info.code));

    this.element = btn;
  }

  public setActive(active: boolean): void {
    this.element.classList.toggle("active", active);
  }
}
