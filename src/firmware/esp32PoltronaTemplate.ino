/**
 * ESP32 Poltrona de Massagem — Top Lavanderia
 * Perfil: timed_session — usa o mesmo fluxo pending_commands action "on"/"off"
 *         com cycle_time_minutes (relé ligado durante a sessão + resfriamento no hardware).
 *
 * Para deploy: use o template esp32LavadoraTemplate.ino gerado pelo painel admin,
 * cadastrando a máquina como tipo "Poltrona de massagem" (device_profile timed_session).
 *
 * Placeholders: __LAUNDRY_ID__, __MACHINE_NAME__, __RELAY_LOGICAL_PIN__, __CYCLE_TIME_MINUTES__
 */

// Este arquivo documenta a integração. O firmware executável é esp32LavadoraTemplate.ino
// com cycle_time_minutes = duração da sessão de massagem (ex.: 15 min).

#define POLTRONA_FIRMWARE_NOTE "Use esp32LavadoraTemplate.ino — action on/off via esp32-monitor"
