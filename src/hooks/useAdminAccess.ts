import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const FALLBACK_PIN = "1234"; // Fallback offline only
const SESSION_TIMEOUT = 300000; // 5 minutos

export const useAdminAccess = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState<NodeJS.Timeout | null>(null);

  const startSession = useCallback(() => {
    if (sessionTimeout) clearTimeout(sessionTimeout);
    const timeout = setTimeout(() => {
      setIsAuthenticated(false);
      setSessionTimeout(null);
    }, SESSION_TIMEOUT);
    setSessionTimeout(timeout);
  }, [sessionTimeout]);

  // Validar PIN via Supabase RPC, com fallback local se offline
  const validatePinRemote = async (pin: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('validate_admin_pin', { _pin: pin });
      if (error) {
        console.warn('[AdminAccess] RPC falhou, usando fallback local:', error.message);
        return pin === FALLBACK_PIN;
      }
      return data === true;
    } catch {
      console.warn('[AdminAccess] Rede indisponível, usando fallback local');
      return pin === FALLBACK_PIN;
    }
  };

  const authenticate = useCallback(async (pin: string): Promise<boolean> => {
    const isValid = await validatePinRemote(pin);
    if (isValid) {
      setIsAuthenticated(true);
      startSession();
    }
    return isValid;
  }, [startSession]);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    if (sessionTimeout) {
      clearTimeout(sessionTimeout);
      setSessionTimeout(null);
    }
  }, [sessionTimeout]);

  const renewSession = useCallback(() => {
    if (isAuthenticated) startSession();
  }, [isAuthenticated, startSession]);

  const validatePin = useCallback(async (pin: string): Promise<boolean> => {
    return validatePinRemote(pin);
  }, []);

  return {
    isAuthenticated,
    authenticate,
    logout,
    renewSession,
    validatePin,
    sessionTimeoutMs: SESSION_TIMEOUT
  };
};
