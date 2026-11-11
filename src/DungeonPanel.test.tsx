// Pruebas de renderizado en servidor de la sección Mazmorras.
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import DungeonBoard from './DungeonBoard';
import DungeonPanel, { autoNext, playFrom, selectionReset } from './DungeonPanel';
import { DUNGEONS } from './lib/dungeons';
import { boardAt } from './lib/dungeons/play';
import { setLang } from './lib/i18n';
import en from './locales/en';
import es from './locales/es';
import fr from './locales/fr';

// Sin navegador: setLang toca document, así que se simula para fijar el español.
vi.stubGlobal('document', { documentElement: {} });
setLang('es');

describe('Mazmorras: panel', () => {
  it('playFrom reinicia en el último paso', () => { expect(playFrom(3, 4)).toBe(0); expect(playFrom(1, 4)).toBe(1); });
  it('autoNext se para al final', () => {
    expect(autoNext(1, 4)).toEqual({ step: 2, playing: true });
    expect(autoNext(2, 4)).toEqual({ step: 3, playing: false });
  });
  it('selectionReset', () => expect(selectionReset()).toEqual({ step: 0, playing: false }));
  it('monta con la primera mazmorra, paso 1 / n y aviso', () => {
    const h = renderToString(<DungeonPanel active />);
    expect(h).toContain('Paso 1 /');
    expect(h).toContain('no comprobadas en el juego');
    expect(h).toContain(DUNGEONS[0].guide);
  });
  it('nombres en el idioma elegido', () => {
    setLang('fr');
    const h = renderToString(<DungeonPanel active />);
    expect(h).toContain(DUNGEONS[0].rooms[0].pieces[0].name.fr);
    setLang('es');
  });
  it('el tablero marca invulnerable', () => {
    // La primera sala (de cualquier mazmorra) con una pieza invulnerable en el paso 0.
    const room = DUNGEONS.flatMap(d => d.rooms).find(r => boardAt(r, 0).pieces.some(p => p.invulnerable));
    expect(room).toBeDefined();
    const h = renderToString(<DungeonBoard state={boardAt(room!, 0)} size={room!.size} roomName="x" />);
    expect(h).toContain('invulnerable');
  });
  it('el tablero marca al actor con dun-actor', () => {
    // El primer paso (de cualquier sala) con actor definido que sea una pieza visible.
    for (const room of DUNGEONS.flatMap(d => d.rooms)) {
      for (let i = 0; i < room.steps.length; i++) {
        const st = boardAt(room, i);
        if (st.actor && st.pieces.some(p => p.id === st.actor)) {
          const h = renderToString(<DungeonBoard state={st} size={room.size} roomName="x" />);
          expect(h).toContain('dun-actor');
          return;
        }
      }
    }
    throw new Error('ninguna sala tiene un paso con actor visible');
  });
  it('los tres idiomas tienen las mismas claves', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
    expect(Object.keys(fr).sort()).toEqual(Object.keys(es).sort());
  });

  it('piezas sin label: inicial + número del nombre, y el label como insignia aparte', () => {
    const n = (s: string) => ({ es: s, en: s, fr: s });
    const room = {
      id: 'r', name: n('Sala'), size: { w: 4, h: 4 }, condition: n('c'), duration: n('d'),
      pieces: [
        { id: 'p1', kind: 'char' as const, name: { es: 'Personaje 1', en: 'Character 1', fr: 'Personnage 1' }, cell: { x: 0, y: 0 } },
        { id: 'p2', kind: 'char' as const, name: { es: 'Personaje 2', en: 'Character 2', fr: 'Personnage 2' }, cell: { x: 1, y: 0 } },
        { id: 'b', kind: 'boss' as const, name: n('Jefe'), cell: { x: 2, y: 0 }, label: '+45 %' },
      ],
      steps: [{ text: n('0'), changes: [] }],
    };
    const h = renderToString(<DungeonBoard state={boardAt(room, 0)} size={room.size} roomName="x" />);
    expect(h).toContain('>P1<');
    expect(h).toContain('>P2<');
    expect(h).toContain('>J<');
    expect(h).toContain('dun-badge');
    expect(h).toContain('+45 %');
  });
  it('los controles van antes del tablero en el DOM', () => {
    const h = renderToString(<DungeonPanel active />);
    expect(h.indexOf('dun-controls')).toBeGreaterThan(-1);
    expect(h.indexOf('dun-controls')).toBeLessThan(h.indexOf('dun-board'));
  });
});
