/**
 * Gera o .ino da lavadora/secadora pronto para gravar (sem placeholders).
 *
 * Uso: node scripts/gen-lavadora-ino.mjs [relayPin] [cicloMin] [nome] [saida]
 * Sem argumentos: relay_2, 40 min, nome da lavanderia, salva em releases/.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const LAUNDRY_ID = '8ace0bcb-83a9-4555-a712-63ef5f52e709';
const relayPin = Number(process.argv[2] || 2);
const cycleMin = Number(process.argv[3] || 40);
const machineName = process.argv[4] || 'TOP LAVANDERIA SINUELO';

const template = fs.readFileSync(
  path.join(root, 'src/firmware/esp32LavadoraTemplate.ino'),
  'utf8'
);

const version = template.match(/#define FIRMWARE_VERSION "([^"]+)"/)?.[1] ?? 'v0';

const out = template
  .replace(/__LAUNDRY_ID__/g, LAUNDRY_ID)
  .replace(/__MACHINE_NAME__/g, machineName)
  .replace(/__RELAY_LOGICAL_PIN__/g, String(relayPin))
  .replace(/__CYCLE_TIME_MINUTES__/g, String(cycleMin))
  .replace(/__WIFI_SSID__/g, '')
  .replace(/__WIFI_PASSWORD__/g, '');

const leftover = out.match(/__[A-Z_]+__/g);
if (leftover) {
  throw new Error(`Placeholders não substituídos: ${[...new Set(leftover)].join(', ')}`);
}

const dest =
  process.argv[5] ||
  path.join(root, `releases/ESP32_Lavadora_${version}_relay${relayPin}_PRONTO.ino`);
fs.writeFileSync(dest, out);
console.log(`OK ${version} relay_${relayPin} ciclo=${cycleMin}min -> ${dest}`);
