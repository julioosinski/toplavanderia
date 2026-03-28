import { useState, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";

// BLE UUIDs for ESP32 TopLav firmware
const TOPLAV_SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const TOPLAV_CHAR_STATUS_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const TOPLAV_CHAR_COMMAND_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a9";
const TOPLAV_CHAR_CONFIG_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26aa";

export interface BLEDevice {
  deviceId: string;
  name: string | null;
  rssi: number;
}

export interface ESP32BLEStatus {
  esp32_id?: string;
  firmware_version?: string;
  wifi_ssid?: string;
  wifi_connected?: boolean;
  ip_address?: string;
  relay_status?: Record<string, string>;
  uptime_seconds?: number;
  signal_strength?: number;
  laundry_id?: string;
}

type BLEState = "idle" | "scanning" | "connecting" | "connected" | "error";

export function useBLEDiagnostics() {
  const [state, setState] = useState<BLEState>("idle");
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<BLEDevice | null>(null);
  const [esp32Status, setEsp32Status] = useState<ESP32BLEStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const bleRef = useRef<any>(null);

  const isNative = Capacitor.isNativePlatform();

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString("pt-BR");
    setLogs(prev => [`[${ts}] ${msg}`, ...prev.slice(0, 99)]);
  }, []);

  const getBLE = useCallback(async () => {
    if (bleRef.current) return bleRef.current;
    const mod = await import("@capacitor-community/bluetooth-le");
    bleRef.current = mod.BleClient;
    return bleRef.current;
  }, []);

  const scan = useCallback(async () => {
    if (!isNative) {
      setError("Bluetooth só funciona no app Android/iOS nativo.");
      return;
    }
    try {
      setError(null);
      setState("scanning");
      setDevices([]);
      addLog("Iniciando scan BLE...");

      const BleClient = await getBLE();
      await BleClient.initialize({ androidNeverForLocation: true });
      await BleClient.requestLEScan(
        { services: [TOPLAV_SERVICE_UUID] },
        (result: any) => {
          const dev: BLEDevice = {
            deviceId: result.device.deviceId,
            name: result.device.name || result.localName || null,
            rssi: result.rssi ?? -100,
          };
          addLog(`Encontrado: ${dev.name || dev.deviceId} (RSSI: ${dev.rssi})`);
          setDevices(prev => {
            const exists = prev.find(d => d.deviceId === dev.deviceId);
            if (exists) return prev.map(d => d.deviceId === dev.deviceId ? dev : d);
            return [...prev, dev];
          });
        }
      );

      // Stop scan after 10s
      setTimeout(async () => {
        try {
          const BleClient = await getBLE();
          await BleClient.stopLEScan();
        } catch { /* ignore */ }
        setState(prev => prev === "scanning" ? "idle" : prev);
        addLog("Scan finalizado.");
      }, 10000);
    } catch (e: any) {
      setError(e.message || "Erro no scan BLE");
      addLog(`Erro scan: ${e.message}`);
      setState("error");
    }
  }, [isNative, addLog, getBLE]);

  const connect = useCallback(async (device: BLEDevice) => {
    try {
      setError(null);
      setState("connecting");
      addLog(`Conectando a ${device.name || device.deviceId}...`);

      const BleClient = await getBLE();
      await BleClient.connect(device.deviceId, () => {
        addLog("Dispositivo desconectado.");
        setState("idle");
        setConnectedDevice(null);
        setEsp32Status(null);
      });

      setConnectedDevice(device);
      setState("connected");
      addLog("Conectado! Lendo status...");

      // Read status characteristic
      try {
        const statusResult = await BleClient.read(
          device.deviceId,
          TOPLAV_SERVICE_UUID,
          TOPLAV_CHAR_STATUS_UUID
        );
        const statusText = new TextDecoder().decode(statusResult);
        const parsed = JSON.parse(statusText) as ESP32BLEStatus;
        setEsp32Status(parsed);
        addLog(`Status: ESP32 ID=${parsed.esp32_id}, WiFi=${parsed.wifi_connected ? "Sim" : "Não"}`);
      } catch (readErr: any) {
        addLog(`Aviso: Não foi possível ler status: ${readErr.message}`);
      }
    } catch (e: any) {
      setError(e.message || "Erro ao conectar");
      addLog(`Erro conexão: ${e.message}`);
      setState("error");
    }
  }, [addLog, getBLE]);

  const disconnect = useCallback(async () => {
    if (!connectedDevice) return;
    try {
      const BleClient = await getBLE();
      await BleClient.disconnect(connectedDevice.deviceId);
      addLog("Desconectado.");
    } catch { /* ignore */ }
    setConnectedDevice(null);
    setEsp32Status(null);
    setState("idle");
  }, [connectedDevice, addLog, getBLE]);

  const sendCommand = useCallback(async (command: string) => {
    if (!connectedDevice) return;
    try {
      addLog(`Enviando comando: ${command}`);
      const BleClient = await getBLE();
      const encoded = new TextEncoder().encode(command);
      await BleClient.write(
        connectedDevice.deviceId,
        TOPLAV_SERVICE_UUID,
        TOPLAV_CHAR_COMMAND_UUID,
        encoded
      );
      addLog(`Comando enviado: ${command}`);

      // Re-read status after command
      await new Promise(r => setTimeout(r, 1000));
      try {
        const statusResult = await BleClient.read(
          connectedDevice.deviceId,
          TOPLAV_SERVICE_UUID,
          TOPLAV_CHAR_STATUS_UUID
        );
        const statusText = new TextDecoder().decode(statusResult);
        const parsed = JSON.parse(statusText) as ESP32BLEStatus;
        setEsp32Status(parsed);
        addLog("Status atualizado após comando.");
      } catch { /* ignore */ }
    } catch (e: any) {
      setError(e.message || "Erro ao enviar comando");
      addLog(`Erro comando: ${e.message}`);
    }
  }, [connectedDevice, addLog, getBLE]);

  const configureWiFi = useCallback(async (ssid: string, password: string) => {
    if (!connectedDevice) return;
    try {
      addLog(`Configurando WiFi: ${ssid}`);
      const BleClient = await getBLE();
      const config = JSON.stringify({ ssid, password });
      const encoded = new TextEncoder().encode(config);
      await BleClient.write(
        connectedDevice.deviceId,
        TOPLAV_SERVICE_UUID,
        TOPLAV_CHAR_CONFIG_UUID,
        encoded
      );
      addLog("Configuração WiFi enviada. ESP32 irá reiniciar...");
    } catch (e: any) {
      setError(e.message || "Erro ao configurar WiFi");
      addLog(`Erro WiFi config: ${e.message}`);
    }
  }, [connectedDevice, addLog, getBLE]);

  return {
    state,
    devices,
    connectedDevice,
    esp32Status,
    error,
    logs,
    isNative,
    scan,
    connect,
    disconnect,
    sendCommand,
    configureWiFi,
  };
}
