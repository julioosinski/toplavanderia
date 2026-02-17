/**
 * nativeStorage — abstração sobre @capacitor/preferences (Android/iOS)
 * com fallback para localStorage na web.
 *
 * Uso: garante que totem_laundry_id sobreviva a limpezas de cache do WebView.
 *
 * Migração automática: na primeira leitura em ambiente nativo, se a chave
 * não existir no Preferences mas existir no localStorage, ela é migrada
 * automaticamente e o valor do localStorage é removido.
 */

import { Capacitor } from '@capacitor/core';

let PreferencesModule: typeof import('@capacitor/preferences').Preferences | null = null;

const getPreferences = async () => {
  if (!PreferencesModule) {
    const mod = await import('@capacitor/preferences');
    PreferencesModule = mod.Preferences;
  }
  return PreferencesModule;
};

const isNative = Capacitor.isNativePlatform();

// Flag de migração em memória para não repetir a varredura a cada leitura
const migratedKeys = new Set<string>();

/**
 * Tenta migrar uma chave do localStorage para o Preferences nativo.
 * Executado apenas uma vez por chave por sessão.
 */
const migrateFromLocalStorage = async (key: string): Promise<void> => {
  if (migratedKeys.has(key)) return;
  migratedKeys.add(key);

  const localValue = localStorage.getItem(key);
  if (localValue !== null) {
    try {
      const Preferences = await getPreferences();
      await Preferences.set({ key, value: localValue });
      localStorage.removeItem(key);
      console.log(`[nativeStorage] Migrado "${key}" do localStorage → Preferences`);
    } catch (e) {
      console.warn(`[nativeStorage] Falha ao migrar "${key}":`, e);
    }
  }
};

export const nativeStorage = {
  async getItem(key: string): Promise<string | null> {
    if (isNative) {
      try {
        const Preferences = await getPreferences();
        const { value } = await Preferences.get({ key });

        // Se não há valor no Preferences, verificar se há migração pendente do localStorage
        if (value === null) {
          await migrateFromLocalStorage(key);
          // Re-ler após tentativa de migração
          const { value: migrated } = await Preferences.get({ key });
          return migrated;
        }

        // Marcar como já migrado para não repetir a verificação
        migratedKeys.add(key);
        return value;
      } catch (e) {
        console.warn('[nativeStorage] Preferences.get falhou, usando localStorage:', e);
      }
    }
    return localStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isNative) {
      try {
        const Preferences = await getPreferences();
        await Preferences.set({ key, value });
        // Manter localStorage em sync como backup
        localStorage.setItem(key, value);
        // Marcar chave como migrada para evitar reprocessamento
        migratedKeys.add(key);
        return;
      } catch (e) {
        console.warn('[nativeStorage] Preferences.set falhou, usando localStorage:', e);
      }
    }
    localStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    if (isNative) {
      try {
        const Preferences = await getPreferences();
        await Preferences.remove({ key });
      } catch (e) {
        console.warn('[nativeStorage] Preferences.remove falhou, usando localStorage:', e);
      }
    }
    localStorage.removeItem(key);
    migratedKeys.delete(key);
  },
};

