import type { Cell } from '../../sim/formulas';
import type { Dungeon, L10n, Piece, Step } from '../types';

// Tour Minérale (36-50). Fuente: https://wakfu.guide/donjons/36-50/ (imágenes d332 y d333).
// d333 (patrón 2): el boss rodeado de barreras de colores. d332: cristales elementales repartidos por el mapa.
// La guía no da casillas ni colores concretos: todas las posiciones son un ejemplo; la forma real de la sala no se reproduce.
// Sin comprobar en el juego.

const boss = (cell: Cell, invulnerable = false): Piece => ({
  id: 'boss', kind: 'boss', cell, ...(invulnerable ? { invulnerable } : {}),
  name: {
    es: 'Boss de la Tour Minérale', // nombre pendiente: es
    en: 'Tour Minérale boss', // nombre pendiente: en
    fr: 'Boss de la Tour Minérale', // nombre pendiente: fr
  },
});

const barrier = (n: number, cell: Cell): Piece => ({
  id: `b${n}`, kind: 'special', cell, label: String(n),
  name: { es: `Barrière ${n}`, en: `Barrier ${n}`, fr: `Barrière ${n}` }, // nombre pendiente: es, en
});

const stone = (n: number, cell: Cell): Piece => ({
  id: `s${n}`, kind: 'special', cell, label: String(n),
  name: { es: `Pierre ${n}`, en: `Stone ${n}`, fr: `Pierre ${n}` }, // nombre pendiente: es, en
});

const crystal = (n: number, cell: Cell): Piece => ({
  id: `c${n}`, kind: 'special', cell,
  name: { es: `Cristal élémentaire ${n}`, en: `Elemental crystal ${n}`, fr: `Cristal élémentaire ${n}` }, // nombre pendiente: es, en
});

const chara = (cell: Cell): Piece => ({
  id: 'pj1', kind: 'char', cell,
  name: { es: 'Personaje 1', en: 'Character 1', fr: 'Personnage 1' },
  role: { es: 'A distancia', en: 'Ranged', fr: 'À distance' },
});

const crystals: L10n = { es: 'Cristales en pie', en: 'Crystals standing', fr: 'Cristaux debout' };

const breakStone = (n: number): Step => ({
  actor: 'pj1',
  text: {
    es: `El Personaje 1 rompe la piedra ${n}, del mismo color que la barrera ${n}, y esa barrera desaparece.`,
    en: `Character 1 breaks stone ${n}, the same color as barrier ${n}, and that barrier disappears.`,
    fr: `Le Personnage 1 brise la pierre ${n}, de la même couleur que la barrière ${n}, et cette barrière disparaît.`,
  },
  changes: [{ type: 'remove', piece: `s${n}` }, { type: 'remove', piece: `b${n}` }],
});

const breakCrystal = (n: number, left: number): Step => ({
  actor: 'pj1',
  text: {
    es: `Se destruye el cristal elemental ${n}${left ? '' : ': era el último'}.`,
    en: `Elemental crystal ${n} is destroyed${left ? '' : ': it was the last one'}.`,
    fr: `Le cristal élémentaire ${n} est détruit${left ? '' : ' : c’était le dernier'}.`,
  },
  changes: [
    { type: 'remove', piece: `c${n}` },
    { type: 'counter', id: 'crist', name: crystals, value: String(left) },
  ],
});

const d: Dungeon = {
  id: 'tour-minerale',
  tier: [36, 50],
  name: { es: 'Tour Minérale', en: 'Tour Minérale', fr: 'Tour Minérale' }, // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/36-50/',
  rooms: [
    {
      id: 'room1',
      name: { es: 'Patrón 2: barreras', en: 'Pattern 2: barriers', fr: 'Schéma 2 : barrières' },
      size: { w: 9, h: 9 },
      pieces: [
        boss({ x: 4, y: 4 }),
        barrier(1, { x: 4, y: 3 }),
        barrier(2, { x: 5, y: 4 }),
        barrier(3, { x: 4, y: 5 }),
        barrier(4, { x: 3, y: 4 }),
        stone(1, { x: 1, y: 1 }),
        stone(2, { x: 7, y: 1 }),
        stone(3, { x: 7, y: 7 }),
        stone(4, { x: 1, y: 7 }),
        chara({ x: 4, y: 8 }),
      ],
      condition: {
        es: 'Sin invulnerabilidad: en el patrón 2 el boss invoca 4 barreras de colores que bloquean la línea de visión; se rompen las piedras del mismo color.',
        en: 'No invulnerability: in pattern 2 the boss summons 4 colored barriers that block line of sight; break the stones of the same color.',
        fr: 'Pas d’invulnérabilité : au schéma 2 le boss invoque 4 barrières colorées qui bloquent la ligne de vue ; on brise les pierres de même couleur.',
      },
      duration: {
        es: 'La guía no indica cuánto duran las barreras; también se puede pegar al boss cuerpo a cuerpo desde una barrera.',
        en: 'The guide does not say how long the barriers last; you can also melee the boss from a barrier.',
        fr: 'Le guide n’indique pas la durée des barrières ; on peut aussi frapper le boss au corps à corps depuis une barrière.',
      },
      steps: [
        {
          text: {
            es: 'Situación inicial: 4 barreras rodean al boss y bloquean la línea de visión (el número marca el color; ejemplo).',
            en: 'Initial situation: 4 barriers surround the boss and block line of sight (the number marks the color; example positions).',
            fr: 'Situation initiale : 4 barrières entourent le boss et bloquent la ligne de vue (le numéro = la couleur ; exemple).',
          },
          changes: [],
        },
        breakStone(1),
        breakStone(2),
        breakStone(3),
        breakStone(4),
        {
          text: {
            es: 'Sin barreras, el boss queda a la vista y se le puede atacar a distancia.',
            en: 'With no barriers left, the boss is in plain sight and can be attacked from range.',
            fr: 'Sans barrières, le boss est à découvert et peut être attaqué à distance.',
          },
          changes: [],
        },
      ],
    },
    {
      id: 'boss',
      name: { es: 'Turno 3: cristales', en: 'Turn 3: crystals', fr: 'Tour 3 : cristaux' },
      size: { w: 9, h: 9 },
      pieces: [
        { ...boss({ x: 4, y: 4 }, true), label: '+300' },
        crystal(1, { x: 1, y: 2 }),
        crystal(2, { x: 7, y: 2 }),
        crystal(3, { x: 7, y: 6 }),
        crystal(4, { x: 1, y: 6 }),
        chara({ x: 4, y: 8 }),
      ],
      condition: {
        es: 'Hacia el turno 3 el boss puede ganar +300 resistencias (aura verde): se quitan destruyendo los 4 cristales elementales del mapa.',
        en: 'Around turn 3 the boss may gain +300 resistances (green aura): destroy the 4 elemental crystals on the map to remove it.',
        fr: 'Vers le tour 3 le boss peut gagner +300 résistances (aura verte) : on les retire en détruisant les 4 cristaux élémentaires de la carte.',
      },
      duration: {
        es: 'La guía no indica cuánto dura el bonus; lo ideal es matar al boss antes del turno 3.',
        en: 'The guide does not say how long the bonus lasts; ideally kill the boss before turn 3.',
        fr: 'Le guide n’indique pas la durée du bonus ; l’idéal est de tuer le boss avant le tour 3.',
      },
      steps: [
        {
          text: {
            es: 'Situación inicial: el boss tiene +300 resistencias; hay 4 cristales elementales (posiciones de ejemplo).',
            en: 'Initial situation: the boss has +300 resistances; 4 elemental crystals are on the map (example positions).',
            fr: 'Situation initiale : le boss a +300 résistances ; 4 cristaux élémentaires sont sur la carte (positions d’exemple).',
          },
          changes: [],
        },
        breakCrystal(1, 3),
        breakCrystal(2, 2),
        breakCrystal(3, 1),
        breakCrystal(4, 0),
        {
          text: {
            es: 'Sin cristales, el boss pierde las +300 resistencias (la guía no indica si vuelven).',
            en: 'With no crystals left, the boss loses the +300 resistances (the guide does not say if they return).',
            fr: 'Sans cristaux, le boss perd les +300 résistances (le guide n’indique pas si elles reviennent).',
          },
          changes: [
            { type: 'aura', piece: 'boss', on: false },
            { type: 'label', piece: 'boss', label: null },
            { type: 'counter', id: 'crist', name: crystals, value: null },
          ],
        },
      ],
    },
  ],
};

export default d;
