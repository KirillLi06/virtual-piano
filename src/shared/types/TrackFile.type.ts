import { TrackPianoEvent } from "./TrackEvent.type.js";

export interface TrackFile {
    name: string;
    date: string;
    events: TrackPianoEvent[];
}