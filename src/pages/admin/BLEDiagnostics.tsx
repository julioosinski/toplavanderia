import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bluetooth,
  BluetoothSearching,
  Wifi,
  WifiOff,
  Zap,
  ZapOff,
  RefreshCw,
  Send,
  Settings,
  Terminal,
  Signal,
  Cpu,
  Heart,
  Download,
} from "lucide-react";
import { useBLEDiagnostics, type BLEDevice } from "@/hooks/useBLEDiagnostics";

export default function BLEDiagnostics() {
  const {
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
    configureDevice,
    readStatus,
  } = useBLEDiagnostics();

  const [wifiSSID, setWifiSSID] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [laundryId, setLaundryId] = useState("");
  const [customCommand, setCustomCommand] = useState("");

  if (!isNative) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Bluetooth ESP32</h1>
          <p className="text-sm text-muted-foreground">Diagnóstico e configuração via Bluetooth</p>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <Bluetooth className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Disponível apenas no App Nativo</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              A comunicação Bluetooth Low Energy (BLE) com os ESP32 só funciona no aplicativo Android/iOS instalado no dispositivo.
              Use o app nativo para acessar esta funcionalidade.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Bluetooth ESP32</h1>
          <p className="text-sm text-muted-foreground">Diagnóstico e configuração via BLE</p>
        </div>
        <Badge variant={state === "connected" ? "default" : "secondary"} className="text-sm">
          {state === "idle" && "Pronto"}
          {state === "scanning" && "Escaneando..."}
          {state === "connecting" && "Conectando..."}
          {state === "connected" && "Conectado"}
          {state === "error" && "Erro"}
        </Badge>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-destructive text-sm">{error}</CardContent>
        </Card>
      )}

      {/* Scan & Device List */}
      {!connectedDevice && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BluetoothSearching size={20} />
              Dispositivos ESP32
            </CardTitle>
            <CardDescription>
              Escaneie para encontrar ESP32s próximos com o serviço TopLav
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={scan} disabled={state === "scanning"} className="w-full">
              {state === "scanning" ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Escaneando...</>
              ) : (
                <><BluetoothSearching className="mr-2 h-4 w-4" />Escanear Dispositivos</>
              )}
            </Button>

            {devices.length > 0 && (
              <div className="space-y-2">
                {devices
                  .sort((a, b) => b.rssi - a.rssi)
                  .map((device) => (
                    <DeviceCard
                      key={device.deviceId}
                      device={device}
                      onConnect={() => connect(device)}
                      connecting={state === "connecting"}
                    />
                  ))}
              </div>
            )}

            {state === "idle" && devices.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-4">
                Nenhum dispositivo encontrado. Certifique-se de que o ESP32 está ligado e próximo.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Connected Device */}
      {connectedDevice && esp32Status && (
        <>
          {/* Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Cpu size={20} />
                  {connectedDevice.name || connectedDevice.deviceId}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={readStatus}>
                    <RefreshCw className="mr-1 h-3 w-3" /> Atualizar
                  </Button>
                  <Button variant="outline" size="sm" onClick={disconnect}>
                    Desconectar
                  </Button>
                </div>
              </div>
              <CardDescription>
                ESP32 ID: {esp32Status.esp32_id || "—"} | Laundry: {esp32Status.laundry_id || "—"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <StatusItem
                  icon={esp32Status.wifi_connected ? <Wifi size={16} className="text-green-600" /> : <WifiOff size={16} className="text-red-500" />}
                  label="WiFi"
                  value={esp32Status.wifi_connected ? esp32Status.wifi_ssid || "Conectado" : "Desconectado"}
                />
                <StatusItem
                  icon={<Signal size={16} className="text-primary" />}
                  label="Sinal"
                  value={esp32Status.signal_strength ? `${esp32Status.signal_strength} dBm` : "—"}
                />
                <StatusItem
                  icon={<Cpu size={16} className="text-primary" />}
                  label="Firmware"
                  value={esp32Status.firmware_version || "—"}
                />
                <StatusItem
                  icon={<Zap size={16} className="text-primary" />}
                  label="Uptime"
                  value={esp32Status.uptime_seconds ? formatUptime(esp32Status.uptime_seconds) : "—"}
                />
              </div>

              {esp32Status.ip_address && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <span className="text-sm text-muted-foreground">IP: </span>
                  <span className="font-mono text-sm">{esp32Status.ip_address}</span>
                </div>
              )}

              {esp32Status.relay_status && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Status dos Relés:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(esp32Status.relay_status).map(([key, val]) => (
                        <Badge
                          key={key}
                          variant={val === "on" ? "default" : "secondary"}
                          className="flex items-center gap-1"
                        >
                          {val === "on" ? <Zap size={12} /> : <ZapOff size={12} />}
                          {key}: {val}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Commands */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send size={20} />
                Comandos
              </CardTitle>
              <CardDescription>Envie comandos diretamente ao ESP32 via Bluetooth</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button variant="outline" size="sm" onClick={() => sendCommand("status")}>
                  <RefreshCw className="mr-1 h-3 w-3" /> Status
                </Button>
                <Button variant="outline" size="sm" onClick={() => sendCommand("relay_1_on")}>
                  <Zap className="mr-1 h-3 w-3" /> Relé 1 ON
                </Button>
                <Button variant="outline" size="sm" onClick={() => sendCommand("relay_1_off")}>
                  <ZapOff className="mr-1 h-3 w-3" /> Relé 1 OFF
                </Button>
                <Button variant="outline" size="sm" onClick={() => sendCommand("restart")}>
                  <RefreshCw className="mr-1 h-3 w-3" /> Reiniciar
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button variant="outline" size="sm" onClick={() => sendCommand("relay_2_on")}>
                  <Zap className="mr-1 h-3 w-3" /> Relé 2 ON
                </Button>
                <Button variant="outline" size="sm" onClick={() => sendCommand("relay_2_off")}>
                  <ZapOff className="mr-1 h-3 w-3" /> Relé 2 OFF
                </Button>
                <Button variant="outline" size="sm" onClick={() => sendCommand("force_heartbeat")}>
                  <Heart className="mr-1 h-3 w-3" /> Forçar Heartbeat
                </Button>
                <Button variant="outline" size="sm" onClick={readStatus}>
                  <Download className="mr-1 h-3 w-3" /> Ler Status
                </Button>
              </div>

              <Separator />

              <div className="flex gap-2">
                <Input
                  placeholder="Comando personalizado..."
                  value={customCommand}
                  onChange={(e) => setCustomCommand(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customCommand.trim()) {
                      sendCommand(customCommand.trim());
                      setCustomCommand("");
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    if (customCommand.trim()) {
                      sendCommand(customCommand.trim());
                      setCustomCommand("");
                    }
                  }}
                  disabled={!customCommand.trim()}
                >
                  <Send size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Device Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings size={20} />
                Configuração do Dispositivo
              </CardTitle>
              <CardDescription>Configure WiFi e Laundry ID do ESP32 via Bluetooth</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>SSID da Rede</Label>
                  <Input
                    placeholder="Nome da rede WiFi"
                    value={wifiSSID}
                    onChange={(e) => setWifiSSID(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    placeholder="Senha do WiFi"
                    value={wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Laundry ID (UUID)</Label>
                  <Input
                    placeholder="UUID da lavanderia"
                    value={laundryId}
                    onChange={(e) => setLaundryId(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Preencha apenas os campos que deseja alterar. O ESP32 reiniciará após receber a configuração WiFi.
              </p>
              <Button
                onClick={() => {
                  const config: Record<string, string> = {};
                  if (wifiSSID.trim()) config.ssid = wifiSSID.trim();
                  if (wifiPassword) config.password = wifiPassword;
                  if (laundryId.trim()) config.laundry_id = laundryId.trim();

                  if (Object.keys(config).length === 0) return;

                  configureDevice(config);
                  setWifiSSID("");
                  setWifiPassword("");
                  setLaundryId("");
                }}
                disabled={!wifiSSID.trim() && !laundryId.trim()}
                className="w-full"
              >
                <Wifi className="mr-2 h-4 w-4" />
                Enviar Configuração
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal size={20} />
            Log de Comunicação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48 rounded-lg border bg-muted/30 p-3">
            {logs.length > 0 ? (
              <div className="space-y-1 font-mono text-xs">
                {logs.map((log, i) => (
                  <div key={i} className="text-muted-foreground">{log}</div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground text-sm py-8">
                Nenhum log ainda. Inicie um scan para começar.
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function DeviceCard({ device, onConnect, connecting }: { device: BLEDevice; onConnect: () => void; connecting: boolean }) {
  const signalLevel = device.rssi > -60 ? "Forte" : device.rssi > -80 ? "Médio" : "Fraco";
  const signalColor = device.rssi > -60 ? "text-green-600" : device.rssi > -80 ? "text-amber-600" : "text-red-500";

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <Bluetooth className="text-primary" size={20} />
        <div>
          <p className="font-medium text-sm">{device.name || "ESP32 Desconhecido"}</p>
          <p className="text-xs text-muted-foreground font-mono">{device.deviceId.slice(0, 17)}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xs font-medium ${signalColor}`}>
          {signalLevel} ({device.rssi} dBm)
        </span>
        <Button size="sm" onClick={onConnect} disabled={connecting}>
          {connecting ? "Conectando..." : "Conectar"}
        </Button>
      </div>
    </div>
  );
}

function StatusItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
