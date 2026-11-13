import type { Cell } from '../../sim/formulas';
import type { Dungeon, L10n, Piece } from '../types';

// Donjon Gerbouille (171-185). Fuente: https://wakfu.guide/donjons/171-185/ (sección «Donjon Gerbouille»).
// Imágenes revisadas: d113/d121 (boss con dos cruces rojas: casilla junto al boss y casilla del personaje, lados opuestos; se usan
// como las 2 casillas de golpe cuerpo a cuerpo), d114-d115 (Pépé/Bébé Gerbouille, no animados), d116 (boss sobre casillas azules de
// burbuja), d117 (ficha «Conducteur»: renvoi eléctrico de 500 daño fijo en zona de 2), d118 (registro de combate: Foudroyé y
// «Conducteur» entre los afectados), d119 (casilla «Feu Sacré» -1 PW, no animada), d120 (zona tachada en rojo, no animada).
// La guía no da la forma de las 8 burbujas: se dibuja el anillo de 8 casillas que rodea al boss (ejemplo); con las dos casillas
// de golpe (lados opuestos) el renvoi de zona 2 desde cada una limpia justo las 8, igual que dice la guía. Boss: «Maman
// Gerbouille» deducido de «Mama Gerbean» (mobs.json). Bébé/Gerbouille/Pépé (inmunes a los renvois) no se animan:
// la guía no los relaciona con la invulnerabilidad del boss. Sin comprobar en el juego.

const T = (es: string, en: string, fr: string): L10n => ({ es, en, fr });

const boss: Piece = {
  id: 'boss', kind: 'boss', cell: { x: 4, y: 4 }, invulnerable: true,
  name: {
    es: 'Mamá Gerbilinda',
    en: 'Mama Gerbean',
    fr: 'Maman Gerbouille',
  },
};

const pj1: Piece = {
  id: 'pj1', kind: 'char', cell: { x: 4, y: 7 },
  name: T('Personaje 1', 'Character 1', 'Personnage 1'),
};

// Anillo de 8 casillas alrededor del boss (ejemplo de disposición de las burbujas).
const ring: Cell[] = [
  { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 },
  { x: 3, y: 4 }, { x: 5, y: 4 },
  { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 },
];
const cellA: Cell = { x: 3, y: 4 }; // lado oeste del boss
const cellB: Cell = { x: 5, y: 4 }; // la otra casilla de golpe (ejemplo: lado este)
// Burbujas a distancia <= 2 de una casilla, sin contar la que hay bajo los pies del personaje.
const near = (c: Cell): Cell[] => ring.filter(r => (r.x !== c.x || r.y !== c.y) && Math.abs(r.x - c.x) + Math.abs(r.y - c.y) <= 2);
const clearedByA = near(cellA);
const left = ring.filter(r => !clearedByA.some(n => n.x === r.x && n.y === r.y));

const d: Dungeon = {
  id: 'gerbouille',
  tier: [171, 185],
  name: {
    es: 'Mazmorra Gerbouille', // nombre pendiente: es
    en: 'Gerbean Dungeon', // nombre pendiente: en
    fr: 'Donjon Gerbouille',
  },
  guide: 'https://wakfu.guide/donjons/171-185/',
  rooms: [
    {
      id: 'boss',
      name: { es: 'Boss: Mamá Gerbilinda', en: 'Boss: Mama Gerbean', fr: 'Boss : Maman Gerbouille' },
      size: { w: 9, h: 9 },
      pieces: [boss, pj1],
      condition: {
        es: 'El boss es invulnerable y está estabilizado. Cada fin de turno pone 8 burbujas electrostáticas; hay que quitarlas con «renvois» eléctricos de personajes Conductor.',
        en: 'The boss is invulnerable and stabilized. Each end of turn it places 8 electrostatic bubbles; remove them with electric “renvois” from Conductor characters.',
        fr: 'Le boss est invulnérable et stabilisé. Chaque fin de tour il pose 8 bulles électrostatiques ; il faut les retirer avec des renvois électriques de personnages Conducteur.',
      },
      duration: {
        es: 'La guía no indica cuánto dura ni si vuelve; el boss queda con 2 PW y sin estabilización. Cuidado: no dejar que llegue al cuerpo a cuerpo (ultimate).',
        en: 'The guide does not say how long it lasts or if it returns; the boss is left with 2 PW and no stabilization. Careful: never let it reach melee (ultimate).',
        fr: 'Le guide n’indique pas la durée ni si elle revient ; le boss reste avec 2 PW et sans stabilisation. Attention : ne jamais le laisser au corps à corps (ultime).',
      },
      steps: [
        {
          text: T(
            'Situación inicial: el boss es invulnerable y está estabilizado; el Personaje 1 aún no es Conductor.',
            'Initial situation: the boss is invulnerable and stabilized; Character 1 is not a Conductor yet.',
            'Situation initiale : le boss est invulnérable et stabilisé ; le Personnage 1 n’est pas encore Conducteur.',
          ),
          changes: [],
        },
        {
          actor: 'boss',
          text: T(
            'El boss muerde al Personaje 1 desde 1-4 casillas: recibe el estado Conductor, permanente en el combate.',
            'The boss bites Character 1 from 1-4 cells: it gets the Conductor state, permanent for the fight.',
            'Le boss mord le Personnage 1 à 1-4 cases : il reçoit l’état Conducteur, permanent pour le combat.',
          ),
          changes: [{ type: 'label', piece: 'pj1', label: '⚡' }],
        },
        {
          actor: 'boss',
          text: T(
            'Al final del turno el boss pone 8 burbujas electrostáticas a su alrededor (disposición de ejemplo).',
            'At the end of the turn the boss places 8 electrostatic bubbles around itself (example layout).',
            'En fin de tour le boss pose 8 bulles électrostatiques autour de lui (disposition d’exemple).',
          ),
          changes: [{ type: 'tiles', cells: ring, color: 'blue' }],
        },
        {
          actor: 'pj1',
          text: T(
            'Turno siguiente: el Conductor golpea en melé desde un lado; el renvoi quita las burbujas cercanas, menos la suya.',
            'Next turn: the Conductor hits in melee from one side; its renvoi clears nearby bubbles, except its own.',
            'Tour suivant : le Conducteur frappe au corps à corps d’un côté ; son renvoi retire les bulles proches, sauf la sienne.',
          ),
          changes: [
            { type: 'move', piece: 'pj1', to: cellA },
            { type: 'zone', zone: { kind: 'hit', cells: [boss.cell] } },
            { type: 'zone', zone: { kind: 'explosion', center: cellA, radius: 2 } },
            { type: 'tiles', cells: clearedByA, color: null },
            { type: 'label', piece: 'boss', label: '+1 PW' },
          ],
        },
        {
          actor: 'pj1',
          text: T(
            'En el mismo turno golpea desde la otra casilla (ejemplo): el renvoi quita las burbujas que faltaban.',
            'In the same turn it hits from the other cell (example): the renvoi clears the remaining bubbles.',
            'Dans le même tour il frappe depuis l’autre case (exemple) : le renvoi retire les bulles restantes.',
          ),
          changes: [
            { type: 'move', piece: 'pj1', to: cellB },
            { type: 'zone', zone: { kind: 'hit', cells: [boss.cell] } },
            { type: 'zone', zone: { kind: 'explosion', center: cellB, radius: 2 } },
            { type: 'tiles', cells: left, color: null },
            { type: 'label', piece: 'boss', label: '+2 PW' },
          ],
        },
        {
          text: T(
            'Sin burbujas, el boss pierde la invulnerabilidad y la estabilización, y queda con solo 2 PW.',
            'With no bubbles left, the boss loses invulnerability and stabilization, with only 2 PW.',
            'Sans bulles, le boss perd l’invulnérabilité et la stabilisation, avec seulement 2 PW.',
          ),
          changes: [{ type: 'aura', piece: 'boss', on: false }],
        },
      ],
    },
  ],
};

export default d;
