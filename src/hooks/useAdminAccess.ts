import { useState, useCallback } from 'react';

const ADMIN_PIN = "1234"; // Em produção, isso deve vir de configuração segura
const SESSION_TIMEOUT = 300000; // 5 minutos em millisegundos

export const useAdminAccess = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState<NodeJS.Timeout | null>(null);

  // Função para autenticar com PIN
  const authenticate = useCallback((pin: string): boolean => {
    if (pin === ADMIN_PIN) {
      setIsAuthenticated(true);
      
      // Configurar timeout da sessão
      if (sessionTimeout) {
        clearTimeout(sessionTimeout);
      }
      
      const timeout = setTimeout(() => {
        setIsAuthenticated(false);
        setSessionTimeout(null);
      }, SESSION_TIMEOUT);
      
      setSessionTimeout(timeout);
      return true;
    }
    return false;
  }, [sessionTimeout]);

  // Função para logout manual
  const logout = useCallback(() => {
    setIsAuthenticated(false);
    if (sessionTimeout) {
      clearTimeout(sessionTimeout);
      setSessionTimeout(null);
    }
  }, [sessionTimeout]);

  // Função para renovar sessão
  const renewSession = useCallback(() => {
    if (isAuthenticated) {
      if (sessionTimeout) {
        clearTimeout(sessionTimeout);
      }
      
      const timeout = setTimeout(() => {
        setIsAuthenticated(false);
        setSessionTimeout(null);
      }, SESSION_TIMEOUT);
      
      setSessionTimeout(timeout);
    }
  }, [isAuthenticated, sessionTimeout]);

  // Verificar se PIN é válido (sem autenticar)
  const validatePin = useCallback((pin: string): boolean => {
    return pin === ADMIN_PIN;
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