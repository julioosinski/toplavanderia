# Informações de Contato e Suporte

## Suporte Técnico Principal

### TopLavanderia Support Team
- **Email:** suporte@toplavanderia.com
- **Horário:** Segunda a Sexta, 8h às 18h (horário comercial)
- **Tempo de resposta:** 24-48 horas para questões técnicas
- **Idiomas:** Português, Inglês

### Canais de Suporte por Categoria

#### 🐛 Bugs e Issues Técnicos
- **GitHub Issues:** [repository-url]/issues
- **Labels disponíveis:**
  - `bug` - Problemas/erros
  - `enhancement` - Melhorias
  - `paygo` - Específico PayGO
  - `esp32` - Hardware ESP32
  - `mobile` - Problemas mobile
  - `documentation` - Docs

#### 📚 Documentação e Tutoriais
- **Base de Conhecimento:** [docs/](../README.md)
- **Video Tutoriais:** [YouTube playlist se disponível]
- **Wiki:** [GitHub Wiki link]

#### 💬 Comunidade
- **Discord Server:** [convite se disponível]
- **Fórum:** [link se disponível]
- **Stack Overflow:** Tag `toplavanderia`

## Suporte por Componente

### PayGO Integration
#### Suporte Oficial PayGO
- **Site:** https://www.paygo.com.br
- **Suporte Técnico:** suporte.tech@paygo.com.br
- **Documentação:** Portal do desenvolvedor PayGO
- **Telefone:** (11) 1234-5678

#### Issues TopLavanderia + PayGO
- **Email:** paygo-integration@toplavanderia.com
- **Especialista:** João Silva (joão@toplavanderia.com)
- **Disponibilidade:** Segunda a Sexta, 9h às 17h

### Hardware ESP32
#### Suporte ESP32 Generic
- **Espressif Forums:** https://esp32.com
- **Documentation:** https://docs.espressif.com
- **GitHub:** https://github.com/espressif/esp-idf

#### Issues TopLavanderia + ESP32
- **Email:** hardware@toplavanderia.com
- **Especialista:** Maria Santos (maria@toplavanderia.com)
- **Include:** Modelo do ESP32, firmware version, logs

### Mobile/Android Development
#### Capacitor Support
- **Official Docs:** https://capacitorjs.com
- **Discord:** https://discord.gg/UPYYRhtyzp
- **GitHub:** https://github.com/ionic-team/capacitor

#### TopLavanderia Mobile Issues
- **Email:** mobile@toplavanderia.com
- **Required Info:**
  - Android version
  - Device model
  - App version
  - Logs from `adb logcat`

### Database/Supabase
#### Supabase Support
- **Documentation:** https://supabase.com/docs
- **Discord:** https://discord.supabase.com
- **GitHub:** https://github.com/supabase/supabase

#### Database Design Questions
- **Email:** database@toplavanderia.com
- **Include:** SQL queries, error messages, table structure

## Níveis de Suporte

### 🆓 Community Support (Gratuito)
- **Canal:** GitHub Issues, Discord, Fórum
- **Resposta:** Best effort da comunidade
- **Disponibilidade:** 24/7 pela comunidade
- **Ideal para:** Dúvidas gerais, bugs básicos

### 🥉 Professional Support
- **Email:** pro-support@toplavanderia.com
- **Preço:** R$ 200/mês
- **Resposta:** 4-8 horas úteis
- **Inclui:** Suporte direto, priority no GitHub
- **Ideal para:** Pequenos negócios

### 🥇 Enterprise Support
- **Email:** enterprise@toplavanderia.com
- **Preço:** Sob consulta
- **Resposta:** 1-2 horas
- **Inclui:** Suporte dedicado, consultoria, SLA
- **Ideal para:** Grandes instalações

## Como Reportar Issues Efetivamente

### Template para Bug Reports
```markdown
**Describe the bug**
Uma descrição clara do problema.

**To Reproduce**
1. Vá para '...'
2. Clique em '....'
3. Veja o erro

**Expected behavior**
O que deveria acontecer.

**Screenshots**
Adicione capturas de tela se aplicável.

**Environment:**
 - Device: [ex. Samsung Galaxy Tab A]
 - OS: [ex. Android 10]
 - App Version: [ex. 1.2.3]
 - PayGO Model: [ex. PPC930]

**Additional context**
Qualquer outro contexto sobre o problema.

**Logs**
```
Cole os logs aqui
```
```

### Informações Essenciais
Sempre inclua:
- **Versão do app** (Settings > About)
- **Modelo do dispositivo** e versão Android
- **Logs completos** do momento do erro
- **Passos para reproduzir** o problema
- **Screenshots** ou vídeos se possível

### Logs Importantes
```bash
# Android logs gerais
adb logcat | grep -E "(TopLavanderia|PayGO|ESP32)"

# Logs específicos do Capacitor
adb logcat | grep -i capacitor

# Logs de rede
adb logcat | grep -i "http\|network\|wifi"

# Crash logs
adb logcat | grep -E "(FATAL|ERROR|AndroidRuntime)"
```

## Tempos de Resposta SLA

### Community (Gratuito)
- **Acknowledgment:** N/A
- **First Response:** Best effort
- **Resolution:** Depends on community

### Professional
- **Acknowledgment:** 2 horas úteis
- **First Response:** 4-8 horas úteis
- **Resolution:** 1-3 dias úteis

### Enterprise
- **Acknowledgment:** 15 minutos
- **First Response:** 1-2 horas
- **Resolution:** 4-24 horas

## Escalation Process

### Nível 1: Autoatendimento
1. Consulte [FAQ](FAQ.md)
2. Busque na documentação
3. Verifique GitHub Issues existentes

### Nível 2: Community Support
1. Abra GitHub Issue
2. Poste no Discord/Fórum
3. Aguarde resposta da comunidade

### Nível 3: Professional Support
1. Email para pro-support@toplavanderia.com
2. Include ticket number se existir
3. Forneça logs e contexto completo

### Nível 4: Enterprise/Critical
1. Email para enterprise@toplavanderia.com
2. Telefone de emergência (se contratado)
3. Escalation automática após X horas

## Feedback e Melhorias

### Feature Requests
- **Canal:** GitHub Issues (label: enhancement)
- **Email:** features@toplavanderia.com
- **Process:** Análise → Roadmap → Implementação

### Feedback Geral
- **Email:** feedback@toplavanderia.com
- **Surveys:** Trimestrais (se inscrever)
- **User Interviews:** Mediante agendamento

## Contribuição Open Source

### Como Contribuir
1. **Fork** o repositório
2. **Create** feature branch
3. **Commit** mudanças
4. **Push** para branch
5. **Create** Pull Request

### Contributor Guidelines
- Siga o style guide do projeto
- Inclua testes para novas features
- Update documentação se necessário
- Use conventional commits

### Reconhecimento
- Contributors listados no README
- Badges especiais no Discord
- Convites para events/meetups

## Informações Legais

### Política de Privacidade
- **Link:** [privacy-policy-url]
- **Contato:** privacy@toplavanderia.com

### Termos de Uso
- **Link:** [terms-of-service-url]
- **Contato:** legal@toplavanderia.com

### Licenciamento
- **Licença:** [especificar licença]
- **Questões:** licensing@toplavanderia.com

## Emergency Contacts

### Production Issues (24/7)
- **Email:** emergency@toplavanderia.com
- **Severity:** Only for production-down situations
- **Response:** 15 minutes acknowledgment

### Security Issues
- **Email:** security@toplavanderia.com
- **PGP Key:** [public-key-link]
- **Response:** 2 hours for critical security issues

---

**Última atualização:** [data]
**Versão do documento:** 1.0
**Próxima revisão:** [data + 3 meses]