import { TrackPianoEvent } from "./TrackEvent.type";

export interface TrackFile {
    name: string;
    date: Date;
    events: TrackPianoEvent[];
}