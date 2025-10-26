"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

interface AvatarContextType {
  isAvatarMode: boolean;
  isAvatarAvailable: boolean;
  toggleMode: () => void;
  setAvatarAvailable: (available: boolean) => void;
}

const AvatarContext = createContext<AvatarContextType | undefined>(undefined);

interface AvatarProviderProps {
  children: ReactNode;
}

export function AvatarProvider({ children }: AvatarProviderProps) {
  const [isAvatarMode, setIsAvatarMode] = useState(false);
  const [isAvatarAvailable, setIsAvatarAvailable] = useState(false);

  // Check if avatar server is available on mount
  useEffect(() => {
    const checkAvatarAvailability = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        
        await fetch("http://127.0.0.1:5501/", { 
          method: "HEAD",
          mode: "no-cors",
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        setIsAvatarAvailable(true);
      } catch (error) {
        setIsAvatarAvailable(false);
        // If avatar becomes unavailable, switch back to text mode
        if (isAvatarMode) {
          setIsAvatarMode(false);
        }
      }
    };

    checkAvatarAvailability();
    
    // Check periodically
    const interval = setInterval(checkAvatarAvailability, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [isAvatarMode]);

  const toggleMode = useCallback(() => {
    if (isAvatarAvailable) {
      setIsAvatarMode(prev => !prev);
    }
  }, [isAvatarAvailable]);

  const setAvatarAvailableCallback = useCallback((available: boolean) => {
    setIsAvatarAvailable(available);
    if (!available && isAvatarMode) {
      setIsAvatarMode(false);
    }
  }, [isAvatarMode]);

  const value = {
    isAvatarMode,
    isAvatarAvailable,
    toggleMode,
    setAvatarAvailable: setAvatarAvailableCallback,
  };

  return (
    <AvatarContext.Provider value={value}>
      {children}
    </AvatarContext.Provider>
  );
}

export function useAvatarMode() {
  const context = useContext(AvatarContext);
  if (context === undefined) {
    throw new Error('useAvatarMode must be used within an AvatarProvider');
  }
  return context;
}