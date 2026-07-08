import esp32FirmwareTemplate from '@/firmware/esp32LavadoraTemplate.ino?raw';
import esp32PoltronaTemplate from '@/firmware/poltrona_massagem_top_lavanderia.ino?raw';
import esp32CafeTemplate from '@/firmware/maquina_cafe_top_lavanderia.ino?raw';
import esp32WifiOtaCommon from '@/firmware/esp32_wifi_ota_common.h?raw';

const ESP32_WIFI_OTA_INCLUDE = '#include "esp32_wifi_ota_common.h"';

/** Header compartilhado Wi-Fi + OTA — deve ficar na mesma pasta do .ino no Arduino IDE */
export function getEsp32WifiOtaCommonHeader(): string {
  return esp32WifiOtaCommon;
}

/** Substitui #include pelo conteúdo do header — sketch único no Arduino IDE. */
export function bundleEsp32WifiOtaHeader(inoContent: string): string {
  if (!inoContent.includes(ESP32_WIFI_OTA_INCLUDE)) {
    return inoContent;
  }

  const includeIdx = inoContent.indexOf(ESP32_WIFI_OTA_INCLUDE);
  const beforeInclude = inoContent.slice(0, includeIdx);
  let afterInclude = inoContent.slice(includeIdx + ESP32_WIFI_OTA_INCLUDE.length);

  // Se FIRMWARE_VERSION estiver depois do include (template antigo), move para antes do header embutido.
  const preHeaderDefines: string[] = [];
  for (const name of ['FIRMWARE_VERSION', 'MACHINE_NAME', 'LAUNDRY_ID', 'DEFAULT_CYCLE_MINUTES']) {
    const re = new RegExp(`\\r?\\n#define ${name}[^\\r\\n]*\\r?\\n`);
    const match = afterInclude.match(re);
    if (match) {
      preHeaderDefines.push(match[0].trim());
      afterInclude = afterInclude.replace(re, '\n');
    }
  }

  const headerBlock =
    `// --- esp32_wifi_ota_common.h (embutido no download) ---\n${esp32WifiOtaCommon}\n// --- fim esp32_wifi_ota_common.h ---\n`;

  const defineBlock =
    preHeaderDefines.length > 0 ? `${preHeaderDefines.join('\n')}\n\n` : '';

  return `${beforeInclude}${defineBlock}${headerBlock}${afterInclude}`;
}

export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Baixa .ino autocontido (header Wi-Fi/OTA embutido). Também baixa o .h separado como backup. */
export function downloadEsp32DeviceFirmware(inoContent: string, inoFilename: string): void {
  downloadTextFile(bundleEsp32WifiOtaHeader(inoContent), inoFilename);
  window.setTimeout(() => {
    downloadTextFile(getEsp32WifiOtaCommonHeader(), 'esp32_wifi_ota_common.h');
  }, 400);
}

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

export interface Esp32PoltronaFirmwareParams {
  laundryId: string;
  machineName: string;
  /** Duração padrão da sessão (min) quando o comando não informar cycle_time_minutes */
  defaultCycleMinutes?: number;
  /** Volumes DFPlayer por faixa (0-30). */
  audioVolumes?: Partial<Record<
    | 'volume_audio_001'
    | 'volume_audio_002'
    | 'volume_audio_003'
    | 'volume_audio_004'
    | 'volume_audio_005'
    | 'volume_audio_006'
    | 'volume_audio_007',
    number
  >>;
}

/**
 * Gera o .ino da poltrona a partir de `src/firmware/poltrona_massagem_top_lavanderia.ino`.
 */
export function buildEsp32PoltronaFirmware(params: Esp32PoltronaFirmwareParams): string {
  const { laundryId, machineName, defaultCycleMinutes, audioVolumes } = params;
  const cycleMin = Math.max(1, Math.min(24 * 60, defaultCycleMinutes ?? 15));
  const normalizedVolumes = {
    volume_audio_001: 27,
    volume_audio_002: 27,
    volume_audio_003: 27,
    volume_audio_004: 27,
    volume_audio_005: 27,
    volume_audio_006: 27,
    volume_audio_007: 18,
  } as const;
  const resolved = { ...normalizedVolumes, ...(audioVolumes ?? {}) };

  let output = esp32PoltronaTemplate
    .replace(/__LAUNDRY_ID__/g, escapeCStr(laundryId))
    .replace(/__MACHINE_NAME__/g, escapeCStr(machineName))
    .replace(/__DEFAULT_CYCLE_MINUTES__/g, String(cycleMin));

  (
    Object.keys(normalizedVolumes) as Array<keyof typeof normalizedVolumes>
  ).forEach((key) => {
    const value = Math.max(0, Math.min(30, Math.round(Number(resolved[key]) || normalizedVolumes[key])));
    output = output.replace(new RegExp(`int\\s+${key}\\s*=\\s*\\d+;`), `int ${key} = ${value};`);
  });

  return output;
}

export interface Esp32CafeFirmwareParams {
  laundryId: string;
  machineName: string;
}

/**
 * Gera o .ino da máquina de café a partir de `src/firmware/maquina_cafe_top_lavanderia.ino`.
 */
export function buildEsp32CafeFirmware(params: Esp32CafeFirmwareParams): string {
  const { laundryId, machineName } = params;

  return esp32CafeTemplate
    .replace(/__LAUNDRY_ID__/g, escapeCStr(laundryId))
    .replace(/__MACHINE_NAME__/g, escapeCStr(machineName));
}
