import { useEffect, useState } from 'react';
import esp32FirmwareTemplate from '@/firmware/esp32LavadoraTemplate.ino?raw';
import esp32PoltronaTemplate from '@/firmware/poltrona_massagem_top_lavanderia.ino?raw';
import esp32CafeTemplate from '@/firmware/maquina_cafe_top_lavanderia.ino?raw';
import esp32WifiOtaCommon from '@/firmware/esp32_wifi_ota_common.h?raw';

const ESP32_WIFI_OTA_INCLUDE = '#include "esp32_wifi_ota_common.h"';

export type Esp32FirmwareKind = 'lavadora' | 'poltrona' | 'cafe' | 'otaHeader';

const GITHUB_RAW =
  'https://raw.githubusercontent.com/julioosinski/toplavanderia/main';
const JSDELIVR =
  'https://cdn.jsdelivr.net/gh/julioosinski/toplavanderia@main';

const REMOTE_PATH: Record<Esp32FirmwareKind, string> = {
  lavadora: 'src/firmware/esp32LavadoraTemplate.ino',
  poltrona: 'src/firmware/poltrona_massagem_top_lavanderia.ino',
  cafe: 'src/firmware/maquina_cafe_top_lavanderia.ino',
  otaHeader: 'src/firmware/esp32_wifi_ota_common.h',
};

const PUBLIC_PATH: Record<Esp32FirmwareKind, string> = {
  lavadora: '/firmware/esp32LavadoraTemplate.ino',
  poltrona: '/firmware/poltrona_massagem_top_lavanderia.ino',
  cafe: '/firmware/maquina_cafe_top_lavanderia.ino',
  otaHeader: '/firmware/esp32_wifi_ota_common.h',
};

const BUNDLED: Record<Esp32FirmwareKind, string> = {
  lavadora: esp32FirmwareTemplate,
  poltrona: esp32PoltronaTemplate,
  cafe: esp32CafeTemplate,
  otaHeader: esp32WifiOtaCommon,
};

const sourceCache: Partial<Record<Esp32FirmwareKind, string>> = {};

/** Versões dos templates canônicos em src/firmware/ — manter alinhado aos #define FIRMWARE_VERSION. */
export const ESP32_LAVADORA_FIRMWARE_VERSION = 'v2.2.8';
export const ESP32_POLTRONA_FIRMWARE_VERSION = 'v1.3.7-toplav-poltrona';
export const ESP32_CAFE_FIRMWARE_VERSION = 'v1.1.0-toplav-cafe';

export function readFirmwareVersionDefine(source: string, fallback: string): string {
  const match = source.match(/#define FIRMWARE_VERSION "([^"]+)"/);
  return match?.[1] ?? fallback;
}

function looksLikeFirmwareSource(kind: Esp32FirmwareKind, text: string): boolean {
  if (text.length < 200 || /<html[\s>]/i.test(text)) {
    return false;
  }
  if (kind === 'otaHeader') {
    return text.includes('ESP32_WIFI_OTA_COMMON_H') || text.includes('pollOtaUpdate');
  }
  return text.includes('#define FIRMWARE_VERSION');
}

async function fetchText(url: string): Promise<string | null> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    return null;
  }
  return response.text();
}

/** Prefer GitHub (sempre a versão do main); fallback: /firmware no site, depois bundle Vite. */
export async function loadCanonicalFirmwareSource(
  kind: Esp32FirmwareKind
): Promise<string> {
  if (sourceCache[kind]) {
    return sourceCache[kind] as string;
  }

  const rel = REMOTE_PATH[kind];
  const urls = [
    `${GITHUB_RAW}/${rel}?t=${Date.now()}`,
    `${JSDELIVR}/${rel}`,
    `${PUBLIC_PATH[kind]}?v=${Date.now()}`,
  ];

  for (const url of urls) {
    try {
      const text = await fetchText(url);
      if (text && looksLikeFirmwareSource(kind, text)) {
        sourceCache[kind] = text;
        return text;
      }
    } catch {
      /* tenta a próxima origem */
    }
  }

  return BUNDLED[kind];
}

export function useCanonicalFirmwareSource(kind: Esp32FirmwareKind) {
  const bundled = BUNDLED[kind];
  const fallbackVersion =
    kind === 'poltrona'
      ? ESP32_POLTRONA_FIRMWARE_VERSION
      : kind === 'cafe'
        ? ESP32_CAFE_FIRMWARE_VERSION
        : ESP32_LAVADORA_FIRMWARE_VERSION;
  const [source, setSource] = useState(bundled);
  const [version, setVersion] = useState(
    readFirmwareVersionDefine(bundled, fallbackVersion)
  );

  useEffect(() => {
    let cancelled = false;
    loadCanonicalFirmwareSource(kind).then((text) => {
      if (cancelled) {
        return;
      }
      setSource(text);
      setVersion(readFirmwareVersionDefine(text, fallbackVersion));
    });
    return () => {
      cancelled = true;
    };
  }, [kind, fallbackVersion]);

  return { source, version };
}

/** Header compartilhado Wi-Fi + OTA — deve ficar na mesma pasta do .ino no Arduino IDE */
export function getEsp32WifiOtaCommonHeader(headerSource = esp32WifiOtaCommon): string {
  return headerSource;
}

/** Substitui #include pelo conteúdo do header — sketch único no Arduino IDE. */
export function bundleEsp32WifiOtaHeader(
  inoContent: string,
  headerSource = esp32WifiOtaCommon
): string {
  if (!inoContent.includes(ESP32_WIFI_OTA_INCLUDE)) {
    return inoContent;
  }

  const includeIdx = inoContent.indexOf(ESP32_WIFI_OTA_INCLUDE);
  const beforeInclude = inoContent.slice(0, includeIdx);
  let afterInclude = inoContent.slice(includeIdx + ESP32_WIFI_OTA_INCLUDE.length);

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
    `// --- esp32_wifi_ota_common.h (embutido no download) ---\n${headerSource}\n// --- fim esp32_wifi_ota_common.h ---\n`;

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
export async function downloadEsp32DeviceFirmware(
  inoContent: string,
  inoFilename: string
): Promise<void> {
  const header = await loadCanonicalFirmwareSource('otaHeader');
  downloadTextFile(bundleEsp32WifiOtaHeader(inoContent, header), inoFilename);
  window.setTimeout(() => {
    downloadTextFile(getEsp32WifiOtaCommonHeader(header), 'esp32_wifi_ota_common.h');
  }, 400);
}

function escapeCStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export interface Esp32FirmwareParams {
  wifiSsid: string;
  wifiPassword: string;
  laundryId: string;
  /** @deprecated ESP32_ID agora é gerado via MAC — campo mantido por compatibilidade */
  esp32Id?: string;
  machineName: string;
  relayLogicalPin?: number;
  cycleTimeMinutes?: number;
}

/**
 * Gera o .ino a partir do template canônico (GitHub/main ou bundle).
 */
export function buildEsp32LavadoraFirmware(
  params: Esp32FirmwareParams,
  templateSource = esp32FirmwareTemplate
): string {
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
  const version = readFirmwareVersionDefine(
    templateSource,
    ESP32_LAVADORA_FIRMWARE_VERSION
  );

  return templateSource
    .replace(/#define FIRMWARE_VERSION "[^"]+"/g, `#define FIRMWARE_VERSION "${version}"`)
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
  defaultCycleMinutes?: number;
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

export function buildEsp32PoltronaFirmware(
  params: Esp32PoltronaFirmwareParams,
  templateSource = esp32PoltronaTemplate
): string {
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

  let output = templateSource
    .replace(/__LAUNDRY_ID__/g, escapeCStr(laundryId))
    .replace(/__MACHINE_NAME__/g, escapeCStr(machineName))
    .replace(/__DEFAULT_CYCLE_MINUTES__/g, String(cycleMin));

  (Object.keys(normalizedVolumes) as Array<keyof typeof normalizedVolumes>).forEach((key) => {
    const value = Math.max(
      0,
      Math.min(30, Math.round(Number(resolved[key]) || normalizedVolumes[key]))
    );
    output = output.replace(new RegExp(`int\\s+${key}\\s*=\\s*\\d+;`), `int ${key} = ${value};`);
  });

  return output;
}

export interface Esp32CafeFirmwareParams {
  laundryId: string;
  machineName: string;
}

export function buildEsp32CafeFirmware(
  params: Esp32CafeFirmwareParams,
  templateSource = esp32CafeTemplate
): string {
  const { laundryId, machineName } = params;

  return templateSource
    .replace(/__LAUNDRY_ID__/g, escapeCStr(laundryId))
    .replace(/__MACHINE_NAME__/g, escapeCStr(machineName));
}
