import type { TrackFile } from "../../shared/types/TrackFile.type.js";

export type TrackFormat = "json" | "txt";

/**
 * Сериализует объект трека в форматированный JSON.
 */
export function serializeTrackToJson(track: TrackFile): string {
  return JSON.stringify(track, null, 2);
}

/**
 * Сериализует объект трека в человекочитаемый текстовый формат (.txt).
 *
 * Формат:
 * # Name: <название трека>
 * # Date: <ISO-8601 дата>
 * NOTE <NoteCode> <freq> <durationMs> [startTimeMs]
 * PAUSE <durationMs>
 */
export function serializeTrackToTxt(track: TrackFile): string {
  const lines: string[] = [`# Name: ${track.name}`, `# Date: ${track.date}`];

  for (const event of track.events) {
    if (event.eventType === "note") {
      const startSuffix =
        event.startTimeMs !== undefined ? ` ${event.startTimeMs}` : "";
      lines.push(
        `NOTE ${event.note} ${event.freq.toFixed(2)} ${event.durationMs}${startSuffix}`,
      );
    } else {
      lines.push(`PAUSE ${event.durationMs}`);
    }
  }

  return lines.join("\n");
}

export function serializeTrack(
  track: TrackFile,
  format: TrackFormat = "json",
): string {
  return format === "txt"
    ? serializeTrackToTxt(track)
    : serializeTrackToJson(track);
}

/**
 * Формирует безопасное имя файла по умолчанию для диалога сохранения.
 */
export function buildDefaultTrackFileName(
  trackName: string,
  format: TrackFormat = "json",
): string {
  const sanitized = trackName
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, "_")
    .replace(/^_+|_+$/g, "");
  const baseName = sanitized.length > 0 ? sanitized : "track";
  return `${baseName}.${format}`;
}
