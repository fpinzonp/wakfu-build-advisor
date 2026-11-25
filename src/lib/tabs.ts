// Patrón de pestañas accesible: solo la pestaña activa entra en el orden de tabulación y las flechas,
// Inicio y Fin mueven el foco entre pestañas y las activan.
import type { KeyboardEvent } from 'react';

export function onTabsKey(e: KeyboardEvent<HTMLElement>) {
  const tabs = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])')];
  const n = tabs.length;
  const i = tabs.indexOf(document.activeElement as HTMLElement);
  if (i < 0 || n === 0) return;
  const next = e.key === 'ArrowRight' ? (i + 1) % n
    : e.key === 'ArrowLeft' ? (i - 1 + n) % n
      : e.key === 'Home' ? 0
        : e.key === 'End' ? n - 1
          : -1;
  if (next < 0) return;
  e.preventDefault();
  tabs[next].focus();
  tabs[next].click();
}

/** Atributos de una pestaña; `panel` es el id del panel que controla, si lo hay. */
export const tabProps = (selected: boolean, panel?: string) => ({
  role: 'tab' as const, 'aria-selected': selected, tabIndex: selected ? 0 : -1, ...(panel ? { 'aria-controls': panel } : {}),
});
