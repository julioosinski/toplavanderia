package app.lovable.toplavanderia;

/**
 * Política de detecção de ESP32 no totem — manter alinhado a
 * {@code src/lib/machineEsp32Sync.ts} ({@code ESP32_TOTEM_HEARTBEAT_STALE_MS}).
 * Firmware envia heartbeat ~30s; ~42s ≈ um ciclo perdido + margem (totem / maquininha).
 */
public final class Esp32TotemPolicy {
    public static final long HEARTBEAT_STALE_MS = 42_000L;
    /** Intervalo entre polls (Cielo: rede + dois RPCs — manter moderado). */
    public static final int STATUS_POLL_INTERVAL_MS = 2_500;

    private Esp32TotemPolicy() {}
}
