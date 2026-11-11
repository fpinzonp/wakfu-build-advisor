import type { Dungeon, L10n, Piece } from '../types';

// Antre d'Excarnus (66-80). Fuente: https://wakfu.guide/donjons/66-80/ (sección sin imágenes propias; solo la cabecera).
// Posiciones y número de personajes son un ejemplo; la forma real de la sala no se reproduce. Sin comprobar en el juego.
// Interpretación: la guía dice que el tótem «terre maudite» da +300 res. a los enemigos y que hay que rematar antes de que
// los tótems vuelvan a la normalidad; no dice expresamente que las +300 caigan al desactivarlo (se deduce).

const window3: L10n = { es: 'Turnos hasta que se reactiven', en: 'Turns until they reactivate', fr: 'Tours avant réactivation' };

const pj = (n: number, cell: Piece['cell'], role: L10n): Piece => ({
  id: `pj${n}`, kind: 'char', cell, role,
  name: { es: `Personaje ${n}`, en: `Character ${n}`, fr: `Personnage ${n}` },
});

const d: Dungeon = {
  id: 'excarnus',
  tier: [66, 80],
  name: { es: 'Guarida de Excarnus', en: 'Excarnus’ Lair', fr: 'Antre d’Excarnus' }, // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/66-80/',
  rooms: [
    {
      id: 'boss',
      name: { es: 'Combate con los tótems', en: 'Totem fight', fr: 'Combat avec les totems' },
      size: { w: 11, h: 7 },
      pieces: [
        {
          id: 'boss', kind: 'boss', cell: { x: 5, y: 3 }, invulnerable: true,
          name: { es: 'Excarnus', en: 'Excarnus', fr: 'Excarnus' }, // nombre pendiente: es
        },
        {
          id: 'totem-tierra', kind: 'special', cell: { x: 10, y: 1 },
          name: { es: 'Tótem tierra maldita', en: 'Cursed earth totem', fr: 'Totem terre maudite' }, // nombre pendiente: es, en
        },
        {
          id: 'totem-macabro', kind: 'special', cell: { x: 5, y: 0 },
          name: { es: 'Tótem macabro', en: 'Macabre totem', fr: 'Totem macabre' }, // nombre pendiente: es, en
        },
        pj(1, { x: 1, y: 3 }, { es: 'Corredor cuerpo a cuerpo', en: 'Melee runner', fr: 'Coureur au corps à corps' }),
        pj(2, { x: 2, y: 5 }, { es: 'A distancia', en: 'Ranged', fr: 'À distance' }),
      ],
      condition: {
        es: 'El tótem «tierra maldita» da +300 res. a todos los enemigos (aura verde en el boss). Los tótems reducen a 0 el daño a distancia que reciben.',
        en: 'The “cursed earth” totem gives +300 res. to every enemy (green aura on the boss). Totems take 0 damage from ranged attacks.',
        fr: 'Le totem « terre maudite » donne +300 rés. à toutes les entités ennemies (aura verte sur le boss). Les totems réduisent à 0 les dégâts à distance reçus.',
      },
      duration: {
        es: '3 turnos: después los tótems vuelven a la normalidad (la guía no dice más).',
        en: '3 turns: afterwards the totems go back to normal (the guide says no more).',
        fr: '3 tours : ensuite les totems redeviennent normaux (le guide n’en dit pas plus).',
      },
      steps: [
        {
          text: {
            es: 'Situación inicial: las +300 res. del tótem «tierra maldita» protegen al boss; el tótem macabro invoca 2 monstruos/turno.',
            en: 'Initial situation: the “cursed earth” totem’s +300 res. protect the boss; the macabre totem summons 2 monsters per turn.',
            fr: 'Situation initiale : les +300 rés. du totem « terre maudite » protègent le boss ; totem macabre : 2 monstres/tour.',
          },
          changes: [],
        },
        {
          actor: 'pj2',
          text: {
            es: 'Un ataque a distancia sobre un tótem hace 0 de daño: no sirve.',
            en: 'A ranged attack on a totem deals 0 damage: it is useless.',
            fr: 'Une attaque à distance sur un totem inflige 0 dégât : inutile.',
          },
          changes: [{ type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 0 }] } }],
        },
        {
          actor: 'pj1',
          text: {
            es: 'El Personaje 1 corre al otro extremo del mapa, hasta el tótem «tierra maldita» (el primero al que hay que ir).',
            en: 'Character 1 runs to the other end of the map, to the “cursed earth” totem (the first one to go for).',
            fr: 'Le Personnage 1 court à l’autre bout de la carte, jusqu’au totem « terre maudite » (le premier à viser).',
          },
          changes: [{ type: 'move', piece: 'pj1', to: { x: 9, y: 1 }, path: [{ x: 3, y: 2 }, { x: 5, y: 2 }, { x: 7, y: 1 }] }],
        },
        {
          actor: 'pj1',
          text: {
            es: 'El Personaje 1 lo golpea cuerpo a cuerpo (o a 3 PO como máximo); queda a 1 PV, desactivado.',
            en: 'Character 1 hits it in melee (or from 3 range at most); it stays at 1 HP, deactivated.',
            fr: 'Le Personnage 1 le frappe au corps à corps (ou à 3 PO max) ; il reste à 1 PV, désactivé.',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 10, y: 1 }] } },
            { type: 'label', piece: 'totem-tierra', label: '1 PV' },
            { type: 'counter', id: 'win', name: window3, value: '3' },
          ],
        },
        {
          text: {
            es: 'Sin las +300 res. el boss queda desprotegido: la guía pide ponerle -200 res. y matarlo antes de que se reactiven.',
            en: 'Without the +300 res. the boss is unprotected: the guide says to apply -200 res. and kill it before they reactivate.',
            fr: 'Sans les +300 rés. le boss est exposé : le guide dit de lui poser -200 rés. et de le tuer avant la réactivation.',
          },
          changes: [{ type: 'aura', piece: 'boss', on: false }],
        },
        {
          text: {
            es: 'Pasados los 3 turnos los tótems vuelven a la normalidad y las +300 res. regresan (deducido de la guía).',
            en: 'After the 3 turns the totems go back to normal and the +300 res. return (deduced from the guide).',
            fr: 'Après les 3 tours les totems redeviennent normaux et les +300 rés. reviennent (déduit du guide).',
          },
          changes: [
            { type: 'aura', piece: 'boss', on: true },
            { type: 'label', piece: 'totem-tierra', label: null },
            { type: 'counter', id: 'win', name: window3, value: null },
          ],
        },
      ],
    },
  ],
};

export default d;
