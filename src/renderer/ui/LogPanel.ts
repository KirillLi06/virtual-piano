import type { LogEntry } from "../../shared/types/LogLevel.type.js";
import type { AirLogger } from "../logger/AirLogger.js";

/**
 * UI-панель журнала AirLogger.
 * Отображает записи с временными метками и цветовой индикацией уровней INFO / WARN / ERROR,
 * автоматически прокручивается к последней записи и позволяет очистить экранный буфер.
 */
export class LogPanel {
  private readonly listElement: HTMLDivElement;
  private readonly unsubscribeLog: () => void;
  private readonly unsubscribeClear: () => void;

  constructor(container: HTMLElement, logger: AirLogger) {
    container.innerHTML = "";

    const header = document.createElement("div");
    header.className = "log-panel__header";

    const title = document.createElement("span");
    title.className = "log-panel__title";
    title.textContent = "Журнал событий (AirLogger)";

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "btn btn--small";
    clearBtn.textContent = "Очистить логи";
    clearBtn.addEventListener("click", () => logger.clearAll());

    header.append(title, clearBtn);

    this.listElement = document.createElement("div");
    this.listElement.className = "log-panel__list";
    this.listElement.setAttribute("role", "log");
    this.listElement.setAttribute("aria-live", "polite");

    container.append(header, this.listElement);

    // Отрисовываем уже накопленные до монтирования UI записи
    for (const entry of logger.getEntries()) {
      this.appendEntry(entry);
    }

    this.unsubscribeLog = logger.subscribe((entry) => {
      this.appendEntry(entry);
    });

    this.unsubscribeClear = logger.onClear(() => {
      this.listElement.innerHTML = "";
    });
  }

  private appendEntry(entry: LogEntry): void {
    const row = document.createElement("div");
    row.className = `log-entry log-entry--${entry.level.toLowerCase()}`;

    const timeSpan = document.createElement("span");
    timeSpan.className = "log-entry__time";
    timeSpan.textContent = `[${entry.timestamp}]`;

    const levelSpan = document.createElement("span");
    levelSpan.className = "log-entry__level";
    levelSpan.textContent = `[${entry.level}]`;

    const msgSpan = document.createElement("span");
    msgSpan.className = "log-entry__message";
    msgSpan.textContent = entry.message;

    row.append(timeSpan, levelSpan, msgSpan);
    this.listElement.appendChild(row);
    this.listElement.scrollTop = this.listElement.scrollHeight;
  }

  public destroy(): void {
    this.unsubscribeLog();
    this.unsubscribeClear();
  }
}
