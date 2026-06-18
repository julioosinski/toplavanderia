import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const template = fs.readFileSync(
  path.join(root, 'src/firmware/esp32LavadoraTemplate.ino'),
  'utf8'
);

const out = template
  .replace(/__LAUNDRY_ID__/g, '8ace0bcb-83a9-4555-a712-63ef5f52e709')
  .replace(/__MACHINE_NAME__/g, 'ESP32 Teste AP')
  .replace(/__RELAY_LOGICAL_PIN__/g, '1')
  .replace(/__CYCLE_TIME_MINUTES__/g, '10');

const header = `/**
 * ESP32 Lavadora Individual — gerado do template v2.2.4 (OTA Wi-Fi + pulso 1 s de crédito).
 * Lavanderia: 8ace0bcb-83a9-4555-a712-63ef5f52e709 | relay_1 | ciclo inicial 10 min
 */

`;

const body = out.replace(/^\/\*\*[\s\S]*?\*\/\s*\n/, '');
const dest = path.join(root, 'public/arduino/generated/ESP32_TESTE_AP_CONFIG_01.ino');
fs.writeFileSync(dest, header + body);
console.log('Wrote', dest, fs.statSync(dest).size, 'bytes');
