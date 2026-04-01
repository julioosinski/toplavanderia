import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Monitor, Smartphone, WifiOff, Home } from "lucide-react";

interface TotemHeaderProps {
  currentTime: Date;
  deviceMode: string;
  isOffline?: boolean;
  laundryName?: string;
  onLogoTap: () => void;
  tapCount?: number;
}

export const TotemHeader = ({ currentTime, deviceMode, isOffline, laundryName, onLogoTap, tapCount = 0 }: TotemHeaderProps) => {
  return (
    <div className="px-2 py-1 shrink-0">
      <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg px-3 py-1.5 shadow-lg">
        <div className="flex items-center space-x-2 select-none" onClick={onLogoTap}>
          <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
            <Sparkles className="text-white" size={14} />
          </div>
          <h1 className="text-base font-bold text-white leading-tight">{laundryName || 'Lavanderia'}</h1>
          {tapCount >= 3 && (
            <div className="flex space-x-1 ml-1">
              {Array.from({ length: tapCount - 2 }, (_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/60 animate-scale-in" />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Link to="/">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-7 w-7" title="Início">
              <Home className="h-3.5 w-3.5" />
            </Button>
          </Link>
          {isOffline && (
            <Badge variant="secondary" className="text-[10px] bg-amber-500/20 text-amber-100 border-0 px-1.5 py-0.5">
              <WifiOff className="mr-0.5 h-2.5 w-2.5" />Offline
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px] bg-white/20 text-white border-0 px-1.5 py-0.5">
            {deviceMode === 'smartpos' ? (
              <><Smartphone className="mr-0.5 h-2.5 w-2.5" />POS</>
            ) : deviceMode === 'totem' ? (
              <><Monitor className="mr-0.5 h-2.5 w-2.5" />Totem</>
            ) : (
              <><Monitor className="mr-0.5 h-2.5 w-2.5" />PWA</>
            )}
          </Badge>
          <div className="text-right text-white leading-tight">
            <div className="text-xs font-semibold">
              {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
