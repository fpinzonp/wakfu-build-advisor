// Pruebas de la sección Equipos por mazmorras (renderizado en servidor y funciones puras).
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import TeamsPanel, { applySwap, initiallyOpen, reqLabel } from './TeamsPanel';
import { focusTarget } from './DungeonPanel';
import { DUNGEONS, byTier } from './lib/dungeons';
import { REQUIREMENTS, needsOf, type DungeonNeeds } from './lib/dungeons/requirements';
import { setLang } from './lib/i18n';
import { type TeamReport } from './lib/teamDungeons';
import { contributions, type Member } from './lib/teams';

// Sin navegador: setLang toca document, así que se simula para fijar el español.
vi.stubGlobal('document', { documentElement: {} });
setLang('es');

// renderToString escapa estos caracteres en el texto.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const render = (props: Partial<Parameters<typeof TeamsPanel>[0]> = {}) => renderToString(
  <TeamsPanel spellData={null} initialClass="feca" onBuild={() => undefined} onOpenDungeon={() => undefined} {...props} />,
);

describe('Equipos: pantalla por mazmorras', () => {
  it('monta con el total, una franja por tramo y el aviso de guías', () => {
    const h = render();
    expect(h).toContain(`/ ${DUNGEONS.length} mazmorras`);
    const tiers = byTier();
    expect(h.match(/<details/g)?.length).toBe(tiers.length);
    for (const g of tiers) expect(h).toContain(`${g.tier[0]}–${g.tier[1]} · `);
    expect(h).toContain('guías');
    // Sin selectores de tamaño ni contenido.
    expect(h).not.toContain('Tamaño del grupo');
  });

  it('initiallyOpen abre solo las franjas incompletas', () => {
    const report = {
      covered: 3, total: 5, tiers: [
        { tier: [1, 2], covered: 2, total: 2, results: [] },
        { tier: [3, 4], covered: 1, total: 3, results: [] },
        { tier: [5, 6], covered: 0, total: 0, results: [] },
      ],
    } as TeamReport;
    expect(initiallyOpen(report)).toEqual([false, true, false]);
  });

  it('applySwap saca la clase anterior de pins, mete la nueva y no toca el estado de entrada', () => {
    const team: Member[] = [
      { classId: 'sram', role: 'melee' }, { classId: 'feca', role: 'tank' }, { classId: 'aniripsa', role: 'heal' },
      { classId: 'xelor', role: 'dist' }, { classId: 'steamer', role: 'dist' }, { classId: 'osamodas', role: 'dist' },
    ];
    const state = { team, pins: ['feca'] };
    const before = structuredClone(state);
    const ocra: Member = { classId: 'ocra', role: 'dist' };
    const next = applySwap(state, 1, ocra);
    expect(next.pins).toEqual(['ocra']);
    expect(next.team[1]).toEqual(ocra);
    expect(next.team.filter((_, i) => i !== 1)).toEqual(team.filter((_, i) => i !== 1));
    expect(state).toEqual(before);
  });

  it('si ningún cambio arregla una mazmorra lo dice y no ofrece botón de cambio', () => {
    const target = DUNGEONS[0].id;
    // Exigencia imposible: siete personajes que resuciten en un grupo de seis.
    const needs = (id: string): DungeonNeeds => (id === target
      ? { size: 6, reqs: [{ need: 'revive', required: true, count: 7, why: { es: 'Imposible.', en: 'Impossible.', fr: 'Impossible.' } }] }
      : needsOf(id));
    const h = render({ needs });
    expect(h).toContain('Ningún cambio de una sola clase');
    expect(h).toContain('Imposible.');
    // Las demás mazmorras se cubren o tienen su propio cambio; la imposible no puede tener botón.
    const block = h.slice(h.indexOf('Imposible.'), h.indexOf('Ningún cambio de una sola clase'));
    expect(block).not.toContain('Cambia ');
  });

  it('en francés muestra nombres de mazmorra y motivos en francés', () => {
    setLang('fr');
    try {
      // Con los datos curados todo equipo recomendado cubre las 27, así que se fuerza una exigencia sin cumplir
      // en la primera mazmorra, con el motivo real de una exigencia del registro.
      const real = Object.values(REQUIREMENTS).flatMap((d) => d.reqs)[0];
      const target = DUNGEONS[0].id;
      const needs = (id: string): DungeonNeeds => (id === target
        ? { size: 6, reqs: [{ ...real, required: true, count: 7 }] }
        : needsOf(id));
      const h = render({ needs });
      expect(h).toContain(esc(DUNGEONS[0].name.fr));
      expect(h).toContain(esc(real.why.fr));
      // Nota de colocación del Feca (la clase del usuario, detalle abierto) en francés.
      const place = contributions({ classId: 'feca', role: 'tank' }).find((x) => x.need === 'place')!;
      expect(h).toContain(esc(place.note.fr));
    } finally {
      setLang('es');
    }
  });

  it('reqLabel une los subtipos de colocación', () => {
    const why = { es: '', en: '', fr: '' };
    expect(reqLabel({ need: 'place', place: ['push', 'pull'], required: true, why })).toBe('Colocación (empujar o atraer)');
    expect(reqLabel({ need: 'place', place: ['push', 'pull', 'swap'], required: true, why }))
      .toBe('Colocación (empujar, atraer o intercambiar posiciones)');
    expect(reqLabel({ need: 'place', place: 'teleport', required: true, why })).toBe('Colocación (teletransportar)');
    expect(reqLabel({ need: 'heal', required: true, count: 2, why })).toBe('Curas ×2');
  });
});

describe('Mazmorras: abrir desde Equipos', () => {
  it('focusTarget devuelve el id pedido o la primera mazmorra', () => {
    expect(focusTarget({ id: DUNGEONS[3].id, n: 1 })).toBe(DUNGEONS[3].id);
    expect(focusTarget({ id: 'no-existe', n: 2 })).toBe(DUNGEONS[0].id);
  });
});
