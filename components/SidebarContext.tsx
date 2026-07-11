'use client';

import { createContext, useContext, useState } from 'react';

type SidebarContextValue = {
  abierto: boolean;
  abrir: () => void;
  cerrar: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <SidebarContext.Provider value={{ abierto, abrir: () => setAbierto(true), cerrar: () => setAbierto(false) }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar debe usarse dentro de SidebarProvider');
  return ctx;
}
