import esp32FirmwareTemplate from '@/firmware/esp32LavadoraTemplate.ino?raw';

/** Escape conteúdo dentro de "..." em string C */
function escapeCStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export interface Esp32FirmwareParams {
  wifiSsid: string;
  wifiPassword: string;
  laundryId: string;
  esp32Id: string;
  /** Nome exibido na página HTTP do ESP32 */
  machineName: string;
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
    esp32Id,
    machineName,
  } = params;

  return esp32FirmwareTemplate
    .replace(/__WIFI_SSID__/g, escapeCStr(wifiSsid))
    .replace(/__WIFI_PASSWORD__/g, escapeCStr(wifiPassword))
    .replace(/__LAUNDRY_ID__/g, escapeCStr(laundryId))
    .replace(/__ESP32_ID__/g, escapeCStr(esp32Id))
    .replace(/__MACHINE_NAME__/g, escapeCStr(machineName));
}
