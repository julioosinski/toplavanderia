# Script para monitorar logs do Supabase no APK
# Verifica se a integracao esta funcionando corretamente

Write-Host "Monitorando logs do Supabase..." -ForegroundColor Green
Write-Host "Pressione Ctrl+C para parar" -ForegroundColor Yellow
Write-Host ""

# Filtrar logs relacionados ao Supabase
adb logcat -s "SupabaseHelper" "TopLavanderia" "Capacitor" "WebView" | Select-String -Pattern "Supabase|machines|ESP32|conectividade|erro|sucesso" -Context 2
