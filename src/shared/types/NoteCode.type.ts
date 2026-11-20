type NoteName = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';
export interface NoteCode {
    readonly octave: number;
    readonly note: NoteName;
}

const BASE_FREQUENCIES_OCTAVE_4: Record<NoteName, number> = {
    'C': 261.63,
    'C#': 277.18,
    'D': 293.66,
    'D#': 311.13,
    'E': 329.63,
    'F': 349.23,
    'F#': 369.99,
    'G': 392.00,
    'G#': 415.30,
    'A': 440.00,
    'A#': 466.16,
    'B': 493.88,
};

 export const getFrequency = (code:NoteCode):number => {
    const baseFreq = BASE_FREQUENCIES_OCTAVE_4[code.note];
    return baseFreq * Math.pow(2, code.octave-4)
}
