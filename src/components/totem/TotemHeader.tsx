import { Badge } from "@/components/ui/badge";
import { Sparkles, Monitor, Smartphone, WifiOff } from "lucide-react";

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
    <div className="container mx-auto px-2 py-2">
      <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-2 shadow-lg">
        <div className="flex items-center space-x-2 select-none" onClick={onLogoTap}>
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center relative">
            <Sparkles className="text-white" size={16} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{laundryName || 'Lavanderia'}</h1>
            {deviceMode !== 'smartpos' && (
              <p className="text-blue-100 text-xs">Sistema Automatizado</p>
            )}
          </div>
          {/* Admin gesture feedback dots */}
          {tapCount >= 3 && (
            <div className="flex space-x-1 ml-2">
              {Array.from({ length: tapCount - 2 }, (_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/60 animate-scale-in" />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {isOffline && (
            <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-100 border-0">
              <WifiOff className="mr-1 h-3 w-3" />Offline
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs bg-white/20 text-white border-0">
            {deviceMode === 'smartpos' ? (
              <><Smartphone className="mr-1 h-3 w-3" />Smart POS</>
            ) : deviceMode === 'totem' ? (
              <><Monitor className="mr-1 h-3 w-3" />Totem</>
            ) : (
              <><Monitor className="mr-1 h-3 w-3" />PWA</>
            )}
          </Badge>
          <div className="text-right text-white">
            <div className="text-sm font-semibold">
              {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-xs text-blue-100">
              {currentTime.toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
