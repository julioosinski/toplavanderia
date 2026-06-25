import { Armchair, Coffee, Droplets, Wind, type LucideIcon } from 'lucide-react';

export type MachineDisplayType = 'lavadora' | 'secadora' | 'massage' | 'coffee';

export const MACHINE_TYPE_ORDER: Record<MachineDisplayType, number> = {
  lavadora: 0,
  secadora: 1,
  massage: 2,
  coffee: 3,
};

export interface MachineTypeMeta {
  label: string;
  pluralLabel: string;
  icon: LucideIcon;
  cardBorder: string;
  cardGradient: string;
  titleClass: string;
  iconBg: string;
  accentClass: string;
}

export const MACHINE_TYPE_META: Record<MachineDisplayType, MachineTypeMeta> = {
  lavadora: {
    label: 'Lavadora',
    pluralLabel: 'Lavadoras',
    icon: Droplets,
    cardBorder: 'border-blue-200',
    cardGradient:
      'from-blue-50/50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/20',
    titleClass: 'text-blue-700 dark:text-blue-400',
    iconBg: 'bg-blue-600',
    accentClass: 'text-blue-600',
  },
  secadora: {
    label: 'Secadora',
    pluralLabel: 'Secadoras',
    icon: Wind,
    cardBorder: 'border-orange-200',
    cardGradient:
      'from-orange-50/50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/20',
    titleClass: 'text-orange-700 dark:text-orange-400',
    iconBg: 'bg-orange-600',
    accentClass: 'text-orange-600',
  },
  massage: {
    label: 'Poltrona de massagem',
    pluralLabel: 'Poltronas de massagem',
    icon: Armchair,
    cardBorder: 'border-violet-200',
    cardGradient:
      'from-violet-50/50 to-violet-100/50 dark:from-violet-950/20 dark:to-violet-900/20',
    titleClass: 'text-violet-700 dark:text-violet-400',
    iconBg: 'bg-violet-600',
    accentClass: 'text-violet-600',
  },
  coffee: {
    label: 'Máquina de café',
    pluralLabel: 'Máquinas de café',
    icon: Coffee,
    cardBorder: 'border-amber-200',
    cardGradient:
      'from-amber-50/50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/20',
    titleClass: 'text-amber-800 dark:text-amber-400',
    iconBg: 'bg-amber-600',
    accentClass: 'text-amber-700',
  },
};

/** Mapeia `machines.type` do Supabase para tipo de exibição no dashboard/totem web. */
export function mapDbMachineType(dbType?: string | null): MachineDisplayType {
  switch (dbType) {
    case 'drying':
    case 'secadora':
      return 'secadora';
    case 'massage':
    case 'poltrona':
      return 'massage';
    case 'coffee':
    case 'cafe':
      return 'coffee';
    case 'washing':
    case 'lavadora':
      return 'lavadora';
    default:
      return 'lavadora';
  }
}

export function sortMachinesByDisplayType<T extends { type: MachineDisplayType; name: string }>(
  machines: T[]
): T[] {
  return [...machines].sort((a, b) => {
    const orderDiff = MACHINE_TYPE_ORDER[a.type] - MACHINE_TYPE_ORDER[b.type];
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

export function getMachineTypeMeta(type: MachineDisplayType): MachineTypeMeta {
  return MACHINE_TYPE_META[type];
}
