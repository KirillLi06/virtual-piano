import { NoteCode } from "./NoteCode.type.js";

export type EventType = 'note' | 'pause';
export type Note = NoteCode | 'PAUSE'
export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface TrackPianoEvent {
    eventType: EventType;
    note: Note;
    durationMs: number;
}