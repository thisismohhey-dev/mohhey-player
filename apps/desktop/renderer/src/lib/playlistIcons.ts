import {
  BookOpen, Briefcase, Car, Coffee, Dumbbell, Flame, Gamepad2, Guitar, Headphones, Heart, ListMusic, Mic, Moon, Music, PartyPopper,
  Plane, Radio, Sparkles, Star, Sun, type LucideIcon,
} from 'lucide-vue-next'
import type { PlaylistIcon } from '@mohhey/contracts'

export const PLAYLIST_ICON_COMPONENTS: Record<PlaylistIcon, LucideIcon> = {
  'list-music': ListMusic, music: Music, heart: Heart, star: Star, flame: Flame, moon: Moon, sun: Sun, coffee: Coffee, car: Car,
  dumbbell: Dumbbell, 'party-popper': PartyPopper, headphones: Headphones, guitar: Guitar, mic: Mic, radio: Radio,
  'book-open': BookOpen, briefcase: Briefcase, gamepad: Gamepad2, plane: Plane, sparkles: Sparkles,
}

export const iconFor = (name: string | undefined): LucideIcon => PLAYLIST_ICON_COMPONENTS[name as PlaylistIcon] ?? ListMusic
