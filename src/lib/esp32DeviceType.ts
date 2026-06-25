export type Esp32ApprovalMachineType = 'lavadora' | 'secadora' | 'massage' | 'coffee';

export const ESP32_MACHINE_TYPE_LABELS: Record<Esp32ApprovalMachineType, string> = {
  lavadora: 'Lavadora',
  secadora: 'Secadora',
  massage: 'Poltrona de massagem',
  coffee: 'Máquina de café',
};

export const ESP32_DEVICE_PROFILE_BY_TYPE: Record<Esp32ApprovalMachineType, string> = {
  lavadora: 'credit_pulse',
  secadora: 'credit_pulse',
  massage: 'timed_session',
  coffee: 'coin_dispense',
};

export const ESP32_DB_TYPE_BY_FORM: Record<Esp32ApprovalMachineType, string> = {
  lavadora: 'washing',
  secadora: 'drying',
  massage: 'massage',
  coffee: 'coffee',
};

/** Infere o tipo do equipamento a partir do heartbeat (firmware + nome). */
export function inferEsp32DeviceType(params: {
  firmware_version?: string | null;
  device_name?: string | null;
}): Esp32ApprovalMachineType {
  const fw = (params.firmware_version ?? '').toLowerCase();
  const name = (params.device_name ?? '').toLowerCase();

  // Firmware explícito tem prioridade (evita café aprovado como poltrona pelo nome da máquina).
  if (fw.includes('toplav-cafe') || fw.includes('-cafe')) {
    return 'coffee';
  }

  if (fw.includes('toplav-poltrona') || fw.includes('poltrona')) {
    return 'massage';
  }

  if (fw.startsWith('v2.')) {
    return 'lavadora';
  }

  if (name.includes('poltrona') || name.includes('massagem')) {
    return 'massage';
  }

  if (name.includes('café') || name.includes('cafe') || name.includes('coffee')) {
    return 'coffee';
  }

  return 'lavadora';
}

export function suggestMachineName(
  type: Esp32ApprovalMachineType,
  deviceName?: string | null
): string {
  if (deviceName?.trim()) {
    return deviceName.trim();
  }
  switch (type) {
    case 'massage':
      return 'Poltrona de Massagem';
    case 'coffee':
      return 'Máquina de Café';
    case 'secadora':
      return 'Secadora 01';
    default:
      return 'Lavadora 01';
  }
}

/** IDs inválidos gerados quando o MAC é lido antes de WiFi.mode(). */
export function isSuspiciousEsp32Id(esp32Id?: string | null): boolean {
  if (!esp32Id) return true;
  const id = esp32Id.toLowerCase();
  return id === 'main' || id === 'esp32_03000000' || id === 'esp32_00000000';
}
