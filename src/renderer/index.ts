import { PianoController } from "./app/PianoController.js";
import { KeyboardController } from "./ui/KeyboardController.js";
import { LogPanel } from "./ui/LogPanel.js";
import { PianoKeyboard } from "./ui/PianoKeyboard.js";
import { StatusBar } from "./ui/StatusBar.js";
import { Toolbar } from "./ui/Toolbar.js";

export const pianoCore = new PianoController();

// Доступ из DevTools Console для диагностики и тестирования.
window.pianoCore = pianoCore;

function getRequiredContainer(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Не найден контейнер #${id} в index.html`);
  }
  return el;
}

function mountUI(): void {
  const toolbar = new Toolbar(getRequiredContainer("toolbar"), pianoCore);
  const keyboard = new PianoKeyboard(
    getRequiredContainer("keyboard"),
    pianoCore,
  );
  const keyboardController = new KeyboardController(pianoCore);
  const logPanel = new LogPanel(
    getRequiredContainer("log-panel"),
    pianoCore.logger,
  );
  const statusBar = new StatusBar(
    getRequiredContainer("status-bar"),
    pianoCore,
  );

  window.addEventListener("blur", () => {
    pianoCore.releaseAllNotes();
  });

  window.addEventListener("beforeunload", () => {
    toolbar.destroy();
    keyboard.destroy();
    keyboardController.destroy();
    logPanel.destroy();
    statusBar.destroy();
    void pianoCore.dispose();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountUI, { once: true });
} else {
  mountUI();
}
