import { Droplets, Wind } from "lucide-react";
import { TotemScreenBackBar } from "@/components/totem/TotemScreenBackBar";

interface TotemOperationSelectProps {
  onChoose: (operation: "secadora" | "lavadora") => void;
  /** Ex.: sair do app no totem nativo (primeira tela não tem “tela anterior”). */
  onBack?: () => void;
}

export const TotemOperationSelect = ({ onChoose, onBack }: TotemOperationSelectProps) => {
  return (
    <div className="h-screen bg-white flex flex-col">
      {onBack ? <TotemScreenBackBar onBack={onBack} label="Sair" /> : null}
      <div className="px-4 py-3 text-center border-b border-gray-100 bg-gray-50">
        <p className="text-base font-semibold text-gray-800">Escolha a operação</p>
        <p className="text-xs text-gray-500 mt-1">Toque em uma opção para continuar</p>
      </div>

      <button
        type="button"
        onClick={() => onChoose("secadora")}
        className="flex-1 w-full bg-gradient-to-b from-orange-500 to-orange-600 text-white flex flex-col items-center justify-center gap-4 active:scale-[0.99] active:opacity-95 transition-all duration-150"
      >
        <Wind className="h-20 w-20 drop-shadow-sm" />
        <span className="text-4xl font-extrabold tracking-wide">SECADORA</span>
        <span className="text-sm font-medium opacity-95">Secar roupas</span>
      </button>

      <button
        type="button"
        onClick={() => onChoose("lavadora")}
        className="flex-1 w-full bg-gradient-to-b from-blue-600 to-blue-700 text-white flex flex-col items-center justify-center gap-4 active:scale-[0.99] active:opacity-95 transition-all duration-150"
      >
        <Droplets className="h-20 w-20 drop-shadow-sm" />
        <span className="text-4xl font-extrabold tracking-wide">LAVADORA</span>
        <span className="text-sm font-medium opacity-95">Lavar roupas</span>
      </button>
    </div>
  );
};
