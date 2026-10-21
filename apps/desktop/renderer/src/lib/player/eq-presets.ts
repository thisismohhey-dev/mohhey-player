import { EQ_BANDS, type EqSettings } from '@mohhey/contracts'

type PresetName = Exclude<EqSettings['preset'], 'custom'>

/** Gains in dB for the 10 bands of EQ_BANDS (32 Hz … 16 kHz). */
export const EQ_PRESET_GAINS: Record<PresetName, readonly number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  treble: [0, 0, 0, 0, 0, 1, 3, 5, 6, 6],
  vocal: [-2, -2, -1, 1, 3, 4, 3, 1, 0, -1],
  rock: [5, 4, 2, -1, -2, -1, 2, 4, 5, 5],
  pop: [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2],
  classical: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
  speech: [-6, -5, -3, 0, 2, 4, 5, 3, 0, -3],
}

export const EQ_PRESET_NAMES = Object.keys(EQ_PRESET_GAINS) as PresetName[]

export const presetEq = (preset: PresetName, enabled = true): EqSettings => ({ enabled, preset, gains: [...EQ_PRESET_GAINS[preset]] })
export const BAND_LABELS = EQ_BANDS.map((f) => (f >= 1000 ? `${f / 1000}k` : String(f)))
