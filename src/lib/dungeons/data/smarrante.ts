import type { Dungeon, L10n, Piece } from '../types';

// Caverne Smarrante (111-125). Fuente: https://wakfu.guide/donjons/111-125/ (d431: un personaje cuerpo a cuerpo con el hechizo
// que quita la invulnerabilidad; d432: el Smarillion y casillas de colores tras el empuje de 5 casillas). Los ventiladores y los
// smarmots no se animan (no son la protección). Posiciones y número de personajes son un ejemplo. Sin comprobar en el juego.

const vuln: L10n = { es: 'Vulnerable en el turno de ese personaje', en: 'Vulnerable during that character’s turn', fr: 'Vulnérable pendant le tour de ce personnage' };

const pj = (n: number, cell: Piece['cell']): Piece => ({
  id: `pj${n}`, kind: 'char', cell,
  name: { es: `Personaje ${n}`, en: `Character ${n}`, fr: `Personnage ${n}` },
});

const d: Dungeon = {
  id: 'smarrante',
  tier: [111, 125],
  name: { es: 'Caverna Smarrante', en: 'Smarrante Cavern', fr: 'Caverne Smarrante' }, // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/111-125/',
  rooms: [
    {
      id: 'boss',
      name: { es: 'Boss', en: 'Boss', fr: 'Boss' },
      size: { w: 9, h: 7 },
      pieces: [
        {
          id: 'boss', kind: 'boss', cell: { x: 6, y: 3 }, invulnerable: true,
          name: { es: 'Smarillion', en: 'Smarillion', fr: 'Smarillion' }, // nombre pendiente: es, en
        },
        pj(1, { x: 2, y: 5 }),
      ],
      condition: {
        es: 'El boss es invulnerable (aura verde). Un golpe cuerpo a cuerpo le quita la invulnerabilidad durante el turno de ese personaje.',
        en: 'The boss is invulnerable (green aura). A melee hit removes its invulnerability during that character’s turn.',
        fr: 'Le boss est invulnérable (aura verte). Un coup au corps à corps lui retire l’invulnérabilité pendant le tour de ce personnage.',
      },
      duration: {
        es: 'Solo durante el turno del personaje que golpeó. Si nadie le golpea cuerpo a cuerpo en un turno, lanza una ultimate a todo el mapa.',
        en: 'Only during the turn of the character that hit. If nobody hits it in melee in a turn, it casts an ultimate on the whole map.',
        fr: 'Seulement pendant le tour du personnage qui a frappé. Si personne ne le frappe au corps à corps en un tour, il lance une ultime sur toute la map.',
      },
      steps: [
        {
          text: {
            es: 'Situación inicial: el boss es invulnerable (posiciones de ejemplo).',
            en: 'Initial situation: the boss is invulnerable (example positions).',
            fr: 'Situation initiale : le boss est invulnérable (positions d’exemple).',
          },
          changes: [],
        },
        {
          actor: 'pj1',
          text: {
            es: 'El Personaje 1 se pone cuerpo a cuerpo con el boss.',
            en: 'Character 1 gets into melee range of the boss.',
            fr: 'Le Personnage 1 se place au corps à corps du boss.',
          },
          changes: [{ type: 'move', piece: 'pj1', to: { x: 5, y: 3 }, path: [{ x: 3, y: 5 }, { x: 4, y: 4 }, { x: 4, y: 3 }] }],
        },
        {
          actor: 'pj1',
          text: {
            es: 'El Personaje 1 golpea al boss cuerpo a cuerpo: cae la invulnerabilidad durante su turno.',
            en: 'Character 1 hits the boss in melee: the invulnerability falls during its turn.',
            fr: 'Le Personnage 1 frappe le boss au corps à corps : l’invulnérabilité tombe pendant son tour.',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 6, y: 3 }] } },
            { type: 'aura', piece: 'boss', on: false },
            { type: 'counter', id: 'vuln', name: vuln, value: '✓' },
          ],
        },
        {
          actor: 'pj1',
          text: {
            es: 'Al quitarse la invulnerabilidad, el Personaje 1 sale empujado 5 casillas.',
            en: 'When the invulnerability is removed, Character 1 is pushed 5 cells.',
            fr: 'Quand l’invulnérabilité est retirée, le Personnage 1 est repoussé de 5 cases.',
          },
          changes: [{ type: 'move', piece: 'pj1', to: { x: 0, y: 3 }, path: [{ x: 4, y: 3 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }] }],
        },
        {
          actor: 'pj1',
          text: {
            es: 'Ese personaje golpea al boss en línea en su turno; al acabarlo vuelve la invulnerabilidad (deducido).',
            en: 'That character hits the boss in line during its turn; when it ends the invulnerability returns (deduced).',
            fr: 'Ce personnage frappe le boss en ligne pendant son tour ; à la fin l’invulnérabilité revient (déduit).',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 6, y: 3 }] } },
            { type: 'aura', piece: 'boss', on: true },
            { type: 'counter', id: 'vuln', name: vuln, value: null },
          ],
        },
      ],
    },
  ],
};

export default d;
