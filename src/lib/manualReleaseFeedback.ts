export type ReleaseUsageSnapshot = {
  canRelease: boolean;
  dayCents: number;
  monthCents: number;
  dayLimitCents: number | null;
  monthLimitCents: number | null;
};

export const brlFromCents = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

export const classifyReleaseError = (message: string): { title: string; description: string } => {
  const m = message.toLowerCase();
  if (m.includes('limite diário') || m.includes('limite diario')) {
    return { title: 'Limite diário atingido', description: message };
  }
  if (m.includes('limite mensal')) {
    return { title: 'Limite mensal atingido', description: message };
  }
  if (m.includes('sem autorização') || m.includes('sem autorizacao') || m.includes('sem permissão') || m.includes('sem permissao')) {
    return { title: 'Sem autorização para liberar', description: message };
  }
  if (m.includes('esp32')) {
    return { title: 'ESP32 não configurado', description: message };
  }
  return { title: 'Não foi possível liberar', description: message };
};

export const getManualReleaseBlock = (
  usage: ReleaseUsageSnapshot,
  nextReleaseCents: number,
): { title: string; description: string } | null => {
  if (!usage.canRelease) {
    return {
      title: 'Sem autorização para liberar',
      description: 'Este operador ainda não está autorizado em Usuários → Autorização.',
    };
  }

  if (usage.dayLimitCents != null && nextReleaseCents > 0 && usage.dayCents + nextReleaseCents > usage.dayLimitCents) {
    return {
      title: 'Limite diário atingido',
      description: `Hoje já foi usado ${brlFromCents(usage.dayCents)}. Esta liberação adiciona ${brlFromCents(nextReleaseCents)} e ultrapassa o limite diário de ${brlFromCents(usage.dayLimitCents)}.`,
    };
  }

  if (usage.monthLimitCents != null && nextReleaseCents > 0 && usage.monthCents + nextReleaseCents > usage.monthLimitCents) {
    return {
      title: 'Limite mensal atingido',
      description: `Neste mês já foi usado ${brlFromCents(usage.monthCents)}. Esta liberação adiciona ${brlFromCents(nextReleaseCents)} e ultrapassa o limite mensal de ${brlFromCents(usage.monthLimitCents)}.`,
    };
  }

  return null;
};