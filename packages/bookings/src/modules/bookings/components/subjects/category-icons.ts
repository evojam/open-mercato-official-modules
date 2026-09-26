import type { LucideIcon } from 'lucide-react'
import {
  Armchair,
  Bed,
  Bike,
  Box,
  Briefcase,
  Building2,
  Car,
  Circle,
  DoorOpen,
  Dumbbell,
  Forklift,
  HardHat,
  IdCard,
  Tag,
  Truck,
  User,
  Video,
  Wrench,
} from 'lucide-react'

export const CATEGORY_ICONS: Readonly<Record<string, LucideIcon>> = {
  box: Box,
  tag: Tag,
  circle: Circle,
  car: Car,
  truck: Truck,
  bike: Bike,
  'door-open': DoorOpen,
  'building-2': Building2,
  armchair: Armchair,
  wrench: Wrench,
  'hard-hat': HardHat,
  video: Video,
  user: User,
  bed: Bed,
  'id-card': IdCard,
  briefcase: Briefcase,
  dumbbell: Dumbbell,
  forklift: Forklift,
}

export function categoryIcon(name: string | null | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || Box
}
