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

  if (
    fw.includes('poltrona') ||
    fw.includes('toplav-poltrona') ||
    name.includes('poltrona') ||
    name.includes('massagem')
  ) {
    return 'massage';
  }

  if (
    fw.includes('cafe') ||
    fw.includes('toplav-cafe') ||
    name.includes('café') ||
    name.includes('cafe') ||
    name.includes('coffee')
  ) {
    return 'coffee';
  }

  if (fw.startsWith('v2.')) {
    return 'lavadora';
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
