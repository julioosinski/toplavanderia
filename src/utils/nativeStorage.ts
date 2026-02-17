/**
 * nativeStorage — abstração sobre @capacitor/preferences (Android/iOS)
 * com fallback para localStorage na web.
 *
 * Uso: garante que totem_laundry_id sobreviva a limpezas de cache do WebView.
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

export const nativeStorage = {
  async getItem(key: string): Promise<string | null> {
    if (isNative) {
      try {
        const Preferences = await getPreferences();
        const { value } = await Preferences.get({ key });
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
  },
};
