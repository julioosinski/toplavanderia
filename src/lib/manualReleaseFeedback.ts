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
  const raw = (message ?? '').toString();
  const m = raw.toLowerCase();

  if (m.includes('limite diário') || m.includes('limite diario')) {
    return { title: 'Limite diário atingido', description: raw };
  }
  if (m.includes('limite mensal')) {
    return { title: 'Limite mensal atingido', description: raw };
  }
  if (m.includes('sem autorização') || m.includes('sem autorizacao')) {
    return {
      title: 'Sem autorização para liberar',
      description: 'Peça ao gerente para habilitar em Usuários → Autorização.',
    };
  }
  if (m.includes('sem permissão') || m.includes('sem permissao')) {
    return { title: 'Sem permissão', description: raw };
  }
  if (m.includes('sem esp32') || (m.includes('esp32') && m.includes('configurad'))) {
    return {
      title: 'Máquina sem ESP32 configurado',
      description: 'Cadastre um ESP32 para esta máquina no painel de Máquinas.',
    };
  }
  if (m.includes('máquina não encontrada') || m.includes('maquina nao encontrada')) {
    return { title: 'Máquina não encontrada', description: raw };
  }
  if (m.includes('produto de café') || m.includes('produto de cafe')) {
    return { title: 'Produto de café inválido', description: raw };
  }
  if (m.includes('informe product_id') || m.includes('valor_centavos')) {
    return { title: 'Valor de café não informado', description: 'Selecione um produto ou informe o valor.' };
  }
  if (m.includes('não autenticado') || m.includes('nao autenticado')) {
    return { title: 'Sessão expirada', description: 'Faça login novamente para liberar máquinas.' };
  }

  return {
    title: 'Não foi possível liberar',
    description: raw || 'Erro desconhecido ao liberar a máquina.',
  };
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
