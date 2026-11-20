import { NoteCode } from "./NoteCode.type";

export type eventType = 'note' | 'pause';
export type note = NoteCode | 'PAUSE'

export interface TrackPianoEvent {
    eventType: eventType;
    note: note;
    durationMs: number;
}