/**
 * ESP32 Poltrona de Massagem — Top Lavanderia
 *
 * Firmware executável: poltrona_massagem_top_lavanderia.ino
 * Perfil: timed_session — pending_commands action "on"/"off" via esp32-monitor
 *
 * Placeholders ao gerar pelo admin:
 *   __LAUNDRY_ID__
 *   __MACHINE_NAME__
 *   __DEFAULT_CYCLE_MINUTES__  (ex.: 15)
 *
 * Hardware: relé GPIO 26, DFPlayer UART2 (TX=16, RX=17), áudios 001–007 no SD FAT32
 */

#define POLTRONA_FIRMWARE "poltrona_massagem_top_lavanderia.ino"
