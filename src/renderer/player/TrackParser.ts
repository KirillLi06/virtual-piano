import { getFrequency, isNoteCode } from "../../shared/types/NoteCode.type.js";
import type {
  TrackNoteEvent,
  TrackPauseEvent,
  TrackPianoEvent,
} from "../../shared/types/TrackEvent.type.js";
import type { TrackFile } from "../../shared/types/TrackFile.type.js";

/** Максимально допустимая длительность одного события (10 минут), защита от повреждённых файлов. */
const MAX_EVENT_DURATION_MS = 600_000;
/** Максимально допустимое смещение начала события от старта трека (24 часа). */
const MAX_START_TIME_MS = 86_400_000;

export class TrackParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrackParseError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDuration(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_EVENT_DURATION_MS
  );
}

function isValidStartTime(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_START_TIME_MS
  );
}

function isValidFrequency(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Type Guard для события ноты (TrackNoteEvent). */
export function isTrackNoteEvent(value: unknown): value is TrackNoteEvent {
  if (!isRecord(value)) {
    return false;
  }
  const hasValidStartTime =
    value["startTimeMs"] === undefined ||
    isValidStartTime(value["startTimeMs"]);

  return (
    value["eventType"] === "note" &&
    isNoteCode(value["note"]) &&
    isValidFrequency(value["freq"]) &&
    isValidDuration(value["durationMs"]) &&
    hasValidStartTime
  );
}

/** Type Guard для события паузы (TrackPauseEvent). */
export function isTrackPauseEvent(value: unknown): value is TrackPauseEvent {
  if (!isRecord(value)) {
    return false;
  }
  return value["eventType"] === "pause" && isValidDuration(value["durationMs"]);
}

/** Type Guard для любого события трека (TrackPianoEvent). */
export function isTrackPianoEvent(value: unknown): value is TrackPianoEvent {
  return isTrackNoteEvent(value) || isTrackPauseEvent(value);
}

/** Type Guard для полной структуры TrackFile. */
export function isTrackFile(value: unknown): value is TrackFile {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value["name"] !== "string" || value["name"].trim().length === 0) {
    return false;
  }
  if (typeof value["date"] !== "string" || value["date"].trim().length === 0) {
    return false;
  }
  if (!Array.isArray(value["events"])) {
    return false;
  }
  return value["events"].every((item) => isTrackPianoEvent(item));
}

/**
 * Парсит и валидирует JSON-строку трека с использованием Type Guards.
 */
export function parseTrackFromJson(content: string): TrackFile {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch (err) {
    throw new TrackParseError(`Некорректный JSON: ${String(err)}`);
  }

  if (!isTrackFile(raw)) {
    throw new TrackParseError(
      "Структура JSON-файла не соответствует формату TrackFile (проверьте поля name, date и events).",
    );
  }

  return raw;
}

/**
 * Парсит и валидирует текстовый формат трека (.txt).
 * Поддерживаемые строки:
 *   # Name: <название>
 *   # Date: <ISO дата>
 *   NOTE <C4..B4> <freq> <durationMs> <startTimeMs>  (полифонический формат)
 *   NOTE <C4..B4> <freq> <durationMs>                (последовательный формат)
 *   NOTE <C4..B4> <durationMs>                       (частота подставляется из NOTES_MAP)
 *   PAUSE <durationMs>
 */
export function parseTrackFromTxt(
  content: string,
  fallbackName = "Без названия",
): TrackFile {
  const lines = content.split(/\r?\n/);
  let name = fallbackName;
  let date = new Date().toISOString();
  const events: TrackPianoEvent[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNumber = idx + 1;
    const rawLine = lines[idx];
    if (rawLine === undefined) {
      continue;
    }

    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }

    if (line.startsWith("#")) {
      const header = line.slice(1).trim();
      if (header.toLowerCase().startsWith("name:")) {
        const parsedName = header.slice(5).trim();
        if (parsedName.length > 0) {
          name = parsedName;
        }
      } else if (header.toLowerCase().startsWith("date:")) {
        const parsedDate = header.slice(5).trim();
        if (parsedDate.length > 0) {
          date = parsedDate;
        }
      }
      continue;
    }

    const parts = line.split(/\s+/);
    const command = parts[0]?.toUpperCase();

    if (command === "NOTE") {
      const noteToken = parts[1];
      if (!isNoteCode(noteToken)) {
        throw new TrackParseError(
          `Строка ${lineNumber}: неизвестный код ноты "${noteToken ?? ""}". Допустимы C4–B4.`,
        );
      }

      let freq: number;
      let durationMs: number;
      let startTimeMs: number | undefined;

      if (parts.length === 5) {
        freq = Number(parts[2]);
        durationMs = Number(parts[3]);
        startTimeMs = Math.round(Number(parts[4]));
      } else if (parts.length === 4) {
        freq = Number(parts[2]);
        durationMs = Number(parts[3]);
      } else if (parts.length === 3) {
        freq = getFrequency(noteToken);
        durationMs = Number(parts[2]);
      } else {
        throw new TrackParseError(
          `Строка ${lineNumber}: ожидается формат "NOTE <код> <частота> <длительность_мс> [время_старта_мс]".`,
        );
      }

      const candidate: TrackNoteEvent =
        startTimeMs !== undefined
          ? {
              eventType: "note",
              note: noteToken,
              freq,
              durationMs: Math.round(durationMs),
              startTimeMs,
            }
          : {
              eventType: "note",
              note: noteToken,
              freq,
              durationMs: Math.round(durationMs),
            };

      if (!isTrackNoteEvent(candidate)) {
        throw new TrackParseError(
          `Строка ${lineNumber}: некорректная частота, длительность или время старта ноты.`,
        );
      }

      events.push(candidate);
    } else if (command === "PAUSE") {
      if (parts.length !== 2) {
        throw new TrackParseError(
          `Строка ${lineNumber}: ожидается формат "PAUSE <длительность_мс>".`,
        );
      }

      const durationMs = Math.round(Number(parts[1]));
      const candidate: TrackPauseEvent = {
        eventType: "pause",
        durationMs,
      };

      if (!isTrackPauseEvent(candidate)) {
        throw new TrackParseError(
          `Строка ${lineNumber}: некорректная длительность паузы.`,
        );
      }

      events.push(candidate);
    } else {
      throw new TrackParseError(
        `Строка ${lineNumber}: неизвестная команда "${parts[0] ?? ""}". Ожидается NOTE или PAUSE.`,
      );
    }
  }

  return { name, date, events };
}

/**
 * Автоматически определяет формат (.json или .txt) по расширению файла или содержимому
 * и возвращает провалидированный TrackFile.
 */
export function parseTrack(content: string, fileName?: string): TrackFile {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new TrackParseError("Файл трека пуст.");
  }

  const lowerName = fileName?.toLowerCase() ?? "";
  if (lowerName.endsWith(".json")) {
    return parseTrackFromJson(trimmed);
  }
  if (lowerName.endsWith(".txt")) {
    const fallbackName = fileName
      ? fileName.replace(/\.txt$/i, "")
      : "Без названия";
    return parseTrackFromTxt(trimmed, fallbackName);
  }

  if (trimmed.startsWith("{")) {
    return parseTrackFromJson(trimmed);
  }
  return parseTrackFromTxt(trimmed);
}
