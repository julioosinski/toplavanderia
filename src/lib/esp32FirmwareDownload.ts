import esp32FirmwareTemplate from '@/firmware/esp32LavadoraTemplate.ino?raw';

/** Escape conteúdo dentro de "..." em string C */
function escapeCStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export interface Esp32FirmwareParams {
  wifiSsid: string;
  wifiPassword: string;
  laundryId: string;
  /** @deprecated ESP32_ID agora é gerado via MAC — campo mantido por compatibilidade */
  esp32Id?: string;
  /** Nome exibido na página HTTP do ESP32 */
  machineName: string;
  /**
   * Índice lógico do relé no JSON Supabase (`relay_1`, `relay_2`…), igual ao campo relay_pin da máquina no painel.
   */
  relayLogicalPin?: number;
  /** Duração do ciclo em minutos (contagem no sistema; relé recebe pulso de 1 s por crédito). */
  cycleTimeMinutes?: number;
}

/**
 * Gera o .ino a partir do template em `src/firmware/esp32LavadoraTemplate.ino`
 * (mesma base que `public/arduino/ESP32_Lavadora_Individual_CORRIGIDO_v2.ino`).
 */
export function buildEsp32LavadoraFirmware(params: Esp32FirmwareParams): string {
  const {
    wifiSsid,
    wifiPassword,
    laundryId,
    machineName,
    relayLogicalPin,
    cycleTimeMinutes,
  } = params;

  const relayPin = Math.max(1, Math.min(16, relayLogicalPin ?? 1));
  const cycleMin = Math.max(1, Math.min(24 * 60, cycleTimeMinutes ?? 40));

  return esp32FirmwareTemplate
    .replace(/__WIFI_SSID__/g, escapeCStr(wifiSsid))
    .replace(/__WIFI_PASSWORD__/g, escapeCStr(wifiPassword))
    .replace(/__LAUNDRY_ID__/g, escapeCStr(laundryId))
    .replace(/__MACHINE_NAME__/g, escapeCStr(machineName))
    .replace(/__RELAY_LOGICAL_PIN__/g, String(relayPin))
    .replace(/__CYCLE_TIME_MINUTES__/g, String(cycleMin));
}
