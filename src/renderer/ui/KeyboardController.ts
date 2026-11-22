import { getNoteByKeyCode } from "../../shared/index.js";
import type { PianoController } from "../app/PianoController.js";

/**
 * Контроллер физической клавиатуры.
 * Маппит клавиши A–J и 1–7 на ноты C4–B4, отсекает автоповтор (event.repeat)
 * и не перехватывает ввод в полях формы.
 */
export class KeyboardController {
  private readonly controller: PianoController;
  private readonly handleKeyDown: (event: KeyboardEvent) => void;
  private readonly handleKeyUp: (event: KeyboardEvent) => void;

  constructor(controller: PianoController) {
    this.controller = controller;

    this.handleKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (isInteractiveInput(event.target)) {
        return;
      }

      const note = getNoteByKeyCode(event.code);
      if (!note) {
        return;
      }

      event.preventDefault();
      this.controller.pressNote(note);
    };

    this.handleKeyUp = (event: KeyboardEvent): void => {
      const note = getNoteByKeyCode(event.code);
      if (!note) {
        return;
      }

      this.controller.releaseNote(note);
    };

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  public destroy(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }
}

function isInteractiveInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
