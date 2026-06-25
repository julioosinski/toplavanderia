import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type Machine } from '@/hooks/useMachines';
import {
  MACHINE_TYPE_META,
  MACHINE_TYPE_ORDER,
  type MachineDisplayType,
} from '@/lib/machineDisplayTypes';
import { MachineStatusCard } from './MachineStatusCard';

interface MachineTypeSectionsProps {
  machines: Machine[];
  typeFilter: string;
  onSelectMachine: (machine: Machine) => void;
  compact?: boolean;
}

const ORDERED_TYPES = (Object.keys(MACHINE_TYPE_ORDER) as MachineDisplayType[]).sort(
  (a, b) => MACHINE_TYPE_ORDER[a] - MACHINE_TYPE_ORDER[b]
);

export const MachineTypeSections = ({
  machines,
  typeFilter,
  onSelectMachine,
  compact = false,
}: MachineTypeSectionsProps) => {
  return (
    <>
      {ORDERED_TYPES.map((type) => {
        if (typeFilter !== 'all' && typeFilter !== type) return null;

        const grouped = machines.filter((m) => m.type === type);
        if (grouped.length === 0) return null;

        const meta = MACHINE_TYPE_META[type];
        const Icon = meta.icon;

        if (compact) {
          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} className={meta.accentClass} />
                <h4 className="font-semibold text-sm">
                  {meta.pluralLabel} ({grouped.length})
                </h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
                {grouped.map((machine) => (
                  <MachineStatusCard
                    key={machine.id}
                    machine={machine}
                    onClick={() => onSelectMachine(machine)}
                  />
                ))}
              </div>
            </div>
          );
        }

        return (
          <Card
            key={type}
            className={`${meta.cardBorder} bg-gradient-to-r ${meta.cardGradient}`}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 ${meta.iconBg} rounded-full flex items-center justify-center shadow`}
                >
                  <Icon className="text-primary-foreground" size={20} />
                </div>
                <div>
                  <CardTitle className={meta.titleClass}>{meta.pluralLabel}</CardTitle>
                  <CardDescription>{grouped.length} equipamento(s)</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
                {grouped.map((machine) => (
                  <MachineStatusCard
                    key={machine.id}
                    machine={machine}
                    onClick={() => onSelectMachine(machine)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
};
