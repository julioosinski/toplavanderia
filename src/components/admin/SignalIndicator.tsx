import { Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type SignalIndicatorProps = {
  signalStrength: number | null;
  isOnline: boolean;
};

export const SignalIndicator = ({ signalStrength, isOnline }: SignalIndicatorProps) => {
  if (!isOnline || signalStrength === null) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <WifiOff className="h-4 w-4" />
        <span className="text-sm">Offline</span>
      </div>
    );
  }

  // Signal quality based on dBm
  // Excellent: > -50, Good: -50 to -60, Fair: -60 to -70, Poor: < -70
  const getSignalQuality = (dBm: number) => {
    if (dBm > -50) return { label: "Excelente", variant: "default" as const, bars: 4 };
    if (dBm > -60) return { label: "Bom", variant: "default" as const, bars: 3 };
    if (dBm > -70) return { label: "Regular", variant: "secondary" as const, bars: 2 };
    return { label: "Fraco", variant: "destructive" as const, bars: 1 };
  };

  const quality = getSignalQuality(signalStrength);

  return (
    <div className="flex items-center gap-2">
      <Wifi className="h-4 w-4" />
      <Badge variant={quality.variant} className="font-normal">
        {signalStrength} dBm ({quality.label})
      </Badge>
    </div>
  );
};
