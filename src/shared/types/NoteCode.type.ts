export type NoteCode = 'C4' | 'D4' | 'E4' | 'F4' | 'G4' | 'A4' | 'B4';

export interface NoteInfo {
  readonly code: NoteCode;
  readonly labelRu: string;
  readonly frequency: number;
  readonly keyCodes: readonly [string, string];
  readonly keyHint: string;
}

export const NOTES_MAP: ReadonlyMap<NoteCode, NoteInfo> = new Map<NoteCode, NoteInfo>([
  ['C4', { code: 'C4', labelRu: 'До', frequency: 261.63, keyCodes: ['KeyA', 'Digit1'], keyHint: 'A / 1' }],
  ['D4', { code: 'D4', labelRu: 'Ре', frequency: 293.66, keyCodes: ['KeyS', 'Digit2'], keyHint: 'S / 2' }],
  ['E4', { code: 'E4', labelRu: 'Ми', frequency: 329.63, keyCodes: ['KeyD', 'Digit3'], keyHint: 'D / 3' }],
  ['F4', { code: 'F4', labelRu: 'Фа', frequency: 349.23, keyCodes: ['KeyF', 'Digit4'], keyHint: 'F / 4' }],
  ['G4', { code: 'G4', labelRu: 'Соль', frequency: 392.00, keyCodes: ['KeyG', 'Digit5'], keyHint: 'G / 5' }],
  ['A4', { code: 'A4', labelRu: 'Ля', frequency: 440.00, keyCodes: ['KeyH', 'Digit6'], keyHint: 'H / 6' }],
  ['B4', { code: 'B4', labelRu: 'Си', frequency: 493.88, keyCodes: ['KeyJ', 'Digit7'], keyHint: 'J / 7' }],
]);

export function getFrequency(code: NoteCode): number {
  const info = NOTES_MAP.get(code);
  if (!info) {
    throw new Error(`Unknown note code: ${code}`);
  }
  return info.frequency;
}