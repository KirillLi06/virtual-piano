import { PianoController } from './app/PianoController.js';

export const pianoCore = new PianoController();

// Доступ из DevTools Console для проверки этапов 4–7 до подключения графического интерфейса.
window.pianoCore = pianoCore;

// Защита от «залипания» нот при потере фокуса окна и корректное освобождение AudioContext.
window.addEventListener('blur', () => {
  pianoCore.releaseAllNotes();
});

window.addEventListener('beforeunload', () => {
  void pianoCore.dispose();
});