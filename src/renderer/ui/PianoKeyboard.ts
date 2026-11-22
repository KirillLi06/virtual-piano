import { NOTES_MAP, ORDERED_NOTES, type NoteCode } from "../../shared/index.js";
import type { PianoController } from "../app/PianoController.js";
import { PianoKey } from "./PianoKey.js";

/**
 * UI-компонент клавиатуры из 7 клавиш первой октавы (До–Си).
 * Синхронизирует подсветку клавиш (.active) с состоянием PianoController.
 */
export class PianoKeyboard {
  private readonly keys = new Map<NoteCode, PianoKey>();
  private readonly unsubscribe: () => void;

  constructor(container: HTMLElement, controller: PianoController) {
    container.innerHTML = "";

    for (const code of ORDERED_NOTES) {
      const info = NOTES_MAP.get(code);
      if (!info) {
        continue;
      }

      const pianoKey = new PianoKey(info, {
        onPress: (note) => controller.pressNote(note),
        onRelease: (note) => controller.releaseNote(note),
      });

      this.keys.set(code, pianoKey);
      container.appendChild(pianoKey.element);
    }

    this.unsubscribe = controller.subscribeState((state) => {
      const activeSet = new Set(state.activeNotes);
      for (const [code, key] of this.keys) {
        key.setActive(activeSet.has(code));
      }
    });
  }

  public destroy(): void {
    this.unsubscribe();
  }
}
