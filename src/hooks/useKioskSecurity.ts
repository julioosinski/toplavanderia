import { useEffect, useCallback, useState } from 'react';

export const useKioskSecurity = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [securityEnabled, setSecurityEnabled] = useState(false);

  // Função para entrar em tela cheia
  const enterFullscreen = useCallback(async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        await (document.documentElement as any).webkitRequestFullscreen();
      } else if ((document.documentElement as any).msRequestFullscreen) {
        await (document.documentElement as any).msRequestFullscreen();
      }
      setIsFullscreen(true);
    } catch (error) {
      console.warn('Não foi possível entrar em fullscreen:', error);
    }
  }, []);

  // Função para sair da tela cheia
  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
      setIsFullscreen(false);
    } catch (error) {
      console.warn('Não foi possível sair do fullscreen:', error);
    }
  }, []);

  // Interceptar teclas do sistema
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!securityEnabled) return;

    // Bloquear teclas perigosas
    const blockedKeys = [
      'F11', 'F12', 'F5', // Refresh, dev tools, fullscreen toggle
      'Escape', // Sair do fullscreen
      'Tab', // Navegação
      'Alt', 'Meta', 'ContextMenu' // Teclas do sistema
    ];

    // Bloquear combinações de teclas
    if (event.ctrlKey || event.altKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }

    if (blockedKeys.includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }, [securityEnabled]);

  // Bloquear menu de contexto
  const handleContextMenu = useCallback((event: MouseEvent) => {
    if (securityEnabled) {
      event.preventDefault();
      return false;
    }
  }, [securityEnabled]);

  // Bloquear seleção de texto
  const handleSelectStart = useCallback((event: Event) => {
    if (securityEnabled) {
      event.preventDefault();
      return false;
    }
  }, [securityEnabled]);

  // Bloquear drag and drop
  const handleDragStart = useCallback((event: DragEvent) => {
    if (securityEnabled) {
      event.preventDefault();
      return false;
    }
  }, [securityEnabled]);

  // Monitorar mudanças de fullscreen
  const handleFullscreenChange = useCallback(() => {
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).msFullscreenElement
    );
    
    setIsFullscreen(isCurrentlyFullscreen);
    
    // Se saiu do fullscreen e a segurança está ativa, tentar voltar
    if (!isCurrentlyFullscreen && securityEnabled) {
      setTimeout(() => {
        enterFullscreen();
      }, 100);
    }
  }, [securityEnabled, enterFullscreen]);

  // Bloquear navegação do browser
  const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
    if (securityEnabled) {
      event.preventDefault();
      event.returnValue = '';
      return '';
    }
  }, [securityEnabled]);

  // Bloquear tecla back do browser
  const handlePopState = useCallback((event: PopStateEvent) => {
    if (securityEnabled) {
      event.preventDefault();
      window.history.pushState(null, '', window.location.href);
    }
  }, [securityEnabled]);

  // Ativar/desativar segurança
  const enableSecurity = useCallback(async () => {
    setSecurityEnabled(true);
    await enterFullscreen();
    
    // Adicionar histórico para bloquear botão voltar
    window.history.pushState(null, '', window.location.href);
  }, [enterFullscreen]);

  const disableSecurity = useCallback(async () => {
    setSecurityEnabled(false);
    await exitFullscreen();
  }, [exitFullscreen]);

  // Configurar event listeners
  useEffect(() => {
    // Event listeners para segurança
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    // CSS para desabilitar seleção quando segurança ativa
    const style = document.createElement('style');
    style.textContent = `
      .kiosk-security-active {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }
      .kiosk-security-active * {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.head.removeChild(style);
    };
  }, [
    handleKeyDown,
    handleContextMenu,
    handleSelectStart,
    handleDragStart,
    handleFullscreenChange,
    handleBeforeUnload,
    handlePopState
  ]);

  // Aplicar classe CSS quando segurança está ativa
  useEffect(() => {
    if (securityEnabled) {
      document.body.classList.add('kiosk-security-active');
    } else {
      document.body.classList.remove('kiosk-security-active');
    }
  }, [securityEnabled]);

  return {
    isFullscreen,
    securityEnabled,
    enableSecurity,
    disableSecurity,
    enterFullscreen,
    exitFullscreen
  };
};