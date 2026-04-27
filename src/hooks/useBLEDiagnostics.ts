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
type BleClientType = typeof import("@capacitor-community/bluetooth-le")["BleClient"];

interface BLEScanResult {
  device: {
    deviceId: string;
    name?: string | null;
  };
  localName?: string | null;
  rssi?: number;
}

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Erro desconhecido";
};

export function useBLEDiagnostics() {
  const [state, setState] = useState<BLEState>("idle");
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<BLEDevice | null>(null);
  const [esp32Status, setEsp32Status] = useState<ESP32BLEStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const bleRef = useRef<BleClientType | null>(null);

  const isNative = Capacitor.isNativePlatform();

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString("pt-BR");
    setLogs(prev => [`[${ts}] ${msg}`, ...prev.slice(0, 99)]);
  }, []);

  const getBLE = useCallback(async (): Promise<BleClientType> => {
    if (bleRef.current) return bleRef.current;
    const mod = await import("@capacitor-community/bluetooth-le");
    bleRef.current = mod.BleClient;
    return bleRef.current;
  }, []);

  const parseStatusData = useCallback((data: DataView | ArrayBuffer | string): ESP32BLEStatus | null => {
    try {
      const text = typeof data === "string" ? data : new TextDecoder().decode(data);
      return JSON.parse(text) as ESP32BLEStatus;
    } catch {
      return null;
    }
  }, []);

  const subscribeNotifications = useCallback(async (deviceId: string) => {
    try {
      const BleClient = await getBLE();
      await BleClient.startNotifications(
        deviceId,
        TOPLAV_SERVICE_UUID,
        TOPLAV_CHAR_STATUS_UUID,
        (value: DataView) => {
          const parsed = parseStatusData(value);
          if (parsed) {
            setEsp32Status(parsed);
            addLog("📡 Status atualizado via notificação BLE");
          }
        }
      );
      addLog("🔔 Notificações BLE ativadas (tempo real)");
    } catch (e: unknown) {
      addLog(`⚠️ Falha ao ativar notificações: ${getErrorMessage(e)}`);
    }
  }, [getBLE, parseStatusData, addLog]);

  const unsubscribeNotifications = useCallback(async (deviceId: string) => {
    try {
      const BleClient = await getBLE();
      await BleClient.stopNotifications(deviceId, TOPLAV_SERVICE_UUID, TOPLAV_CHAR_STATUS_UUID);
    } catch { /* ignore */ }
  }, [getBLE]);

  const readStatus = useCallback(async () => {
    if (!connectedDevice) return;
    try {
      addLog("📖 Lendo status manualmente...");
      const BleClient = await getBLE();
      const statusResult = await BleClient.read(
        connectedDevice.deviceId,
        TOPLAV_SERVICE_UUID,
        TOPLAV_CHAR_STATUS_UUID
      );
      const parsed = parseStatusData(statusResult);
      if (parsed) {
        setEsp32Status(parsed);
        addLog(`Status: ESP32 ID=${parsed.esp32_id}, WiFi=${parsed.wifi_connected ? "Sim" : "Não"}`);
      }
    } catch (e: unknown) {
      addLog(`Erro ao ler status: ${getErrorMessage(e)}`);
    }
  }, [connectedDevice, getBLE, parseStatusData, addLog]);

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
        (result: BLEScanResult) => {
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

      setTimeout(async () => {
        try {
          const BleClient = await getBLE();
          await BleClient.stopLEScan();
        } catch { /* ignore */ }
        setState(prev => prev === "scanning" ? "idle" : prev);
        addLog("Scan finalizado.");
      }, 10000);
    } catch (e: unknown) {
      const errorMessage = getErrorMessage(e);
      setError(errorMessage || "Erro no scan BLE");
      addLog(`Erro scan: ${errorMessage}`);
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

      // Read initial status
      try {
        const statusResult = await BleClient.read(
          device.deviceId,
          TOPLAV_SERVICE_UUID,
          TOPLAV_CHAR_STATUS_UUID
        );
        const parsed = parseStatusData(statusResult);
        if (parsed) {
          setEsp32Status(parsed);
          addLog(`Status: ESP32 ID=${parsed.esp32_id}, WiFi=${parsed.wifi_connected ? "Sim" : "Não"}`);
        }
      } catch (readErr: unknown) {
        addLog(`Aviso: Não foi possível ler status: ${getErrorMessage(readErr)}`);
      }

      // Subscribe to real-time notifications
      await subscribeNotifications(device.deviceId);
    } catch (e: unknown) {
      const errorMessage = getErrorMessage(e);
      setError(errorMessage || "Erro ao conectar");
      addLog(`Erro conexão: ${errorMessage}`);
      setState("error");
    }
  }, [addLog, getBLE, parseStatusData, subscribeNotifications]);

  const disconnect = useCallback(async () => {
    if (!connectedDevice) return;
    try {
      await unsubscribeNotifications(connectedDevice.deviceId);
      const BleClient = await getBLE();
      await BleClient.disconnect(connectedDevice.deviceId);
      addLog("Desconectado.");
    } catch { /* ignore */ }
    setConnectedDevice(null);
    setEsp32Status(null);
    setState("idle");
  }, [connectedDevice, addLog, getBLE, unsubscribeNotifications]);

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
        new DataView(encoded.buffer, encoded.byteOffset, encoded.byteLength)
      );
      addLog(`Comando enviado: ${command}`);
      // Status will auto-update via BLE notifications
    } catch (e: unknown) {
      const errorMessage = getErrorMessage(e);
      setError(errorMessage || "Erro ao enviar comando");
      addLog(`Erro comando: ${errorMessage}`);
    }
  }, [connectedDevice, addLog, getBLE]);

  const configureDevice = useCallback(async (config: { ssid?: string; password?: string; laundry_id?: string }) => {
    if (!connectedDevice) return;
    try {
      const payload: Record<string, string> = {};
      if (config.ssid) payload.ssid = config.ssid;
      if (config.password !== undefined) payload.password = config.password;
      if (config.laundry_id) payload.laundry_id = config.laundry_id;

      addLog(`Enviando configuração: ${Object.keys(payload).join(", ")}`);
      const BleClient = await getBLE();
      const encoded = new TextEncoder().encode(JSON.stringify(payload));
      await BleClient.write(
        connectedDevice.deviceId,
        TOPLAV_SERVICE_UUID,
        TOPLAV_CHAR_CONFIG_UUID,
        new DataView(encoded.buffer, encoded.byteOffset, encoded.byteLength)
      );
      addLog("Configuração enviada. ESP32 irá reiniciar...");
    } catch (e: unknown) {
      const errorMessage = getErrorMessage(e);
      setError(errorMessage || "Erro ao enviar configuração");
      addLog(`Erro config: ${errorMessage}`);
    }
  }, [connectedDevice, addLog, getBLE]);

  // Keep backward-compatible configureWiFi
  const configureWiFi = useCallback(async (ssid: string, password: string) => {
    await configureDevice({ ssid, password });
  }, [configureDevice]);

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
    configureDevice,
    readStatus,
  };
}
