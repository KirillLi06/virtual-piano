import type { NoteCode } from './NoteCode.type.js';

export interface TrackNoteEvent {
  readonly eventType: 'note';
  readonly note: NoteCode;
  readonly freq: number;
  readonly durationMs: number;
}

export interface TrackPauseEvent {
  readonly eventType: 'pause';
  readonly durationMs: number;
}

export type TrackPianoEvent = TrackNoteEvent | TrackPauseEvent;