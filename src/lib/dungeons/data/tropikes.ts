import type { Cell } from '../../sim/formulas';
import type { Dungeon, L10n, Piece, Step } from '../types';

// Donjon des Tropikes (171-185). Fuente: https://wakfu.guide/donjons/171-185/ (imágenes d70-d76).
// Posiciones relativas según d73/d74 (monstruos) y d75/d76 (boss); la forma real de la sala no se reproduce.
// Sin comprobar en el juego.

const nodkoko = (cell: Cell, label: string): Piece => ({
  id: 'nodkoko', kind: 'special', cell, label,
  name: {
    es: 'Nodkoko', // nombre pendiente: es
    en: 'Nodkoko', // nombre pendiente: en
    fr: 'Nodkoko',
  },
});

const pusher = (cell: Cell): Piece => ({
  id: 'pj1', kind: 'char', cell,
  name: { es: 'Personaje 1', en: 'Character 1', fr: 'Personnage 1' },
  role: { es: 'Empujador', en: 'Pusher', fr: 'Pousseur' },
});

const orienter = (cell: Cell): Piece => ({
  id: 'pj2', kind: 'char', cell,
  name: { es: 'Personaje 2', en: 'Character 2', fr: 'Personnage 2' },
  role: { es: 'Orientador', en: 'Orienter', fr: 'Orienteur' },
});

// Paso común: orientar la Nodkoko (de mirar al norte a mirar al oeste, hacia los monstruos).
const orientStep: Step = {
  actor: 'pj2',
  text: {
    es: 'El Personaje 2 golpea a la Nodkoko desde el este para que mire al oeste.',
    en: 'Character 2 hits the Nodkoko from the east so it faces west.',
    fr: 'Le Personnage 2 frappe la Nodkoko depuis l’est pour qu’elle regarde vers l’ouest.',
  },
  changes: [{ type: 'label', piece: 'nodkoko', label: '1 PV ←' }],
};

// Paso común: la Nodkoko avanza 2 casillas hacia el oeste (de la casilla 8 a la 6).
const advanceStep: Step = {
  actor: 'nodkoko',
  text: {
    es: 'Al final del turno la Nodkoko pierde 1 PV (0 PV) y, al inicio del siguiente, avanza 2 casillas al oeste.',
    en: 'At the end of the turn the Nodkoko loses 1 HP (0 HP) and, at the start of the next, advances 2 cells west.',
    fr: 'En fin de tour la Nodkoko perd 1 PV (0 PV) et, au début du suivant, avance de 2 cases vers l’ouest.',
  },
  changes: [
    { type: 'label', piece: 'nodkoko', label: '0 PV ←' },
    { type: 'move', piece: 'nodkoko', to: { x: 6, y: 5 }, path: [{ x: 7, y: 5 }] },
  ],
};

const vulnTurns: L10n = { es: 'Turnos vulnerable', en: 'Vulnerable turns', fr: 'Tours vulnérable' };

const d: Dungeon = {
  id: 'tropikes',
  tier: [171, 185],
  name: { es: 'Mazmorra de los Tropikes', en: 'Tropikes Dungeon', fr: 'Donjon des Tropikes' }, // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/171-185/',
  rooms: [
    {
      id: 'room1',
      name: { es: 'Sala 1', en: 'Room 1', fr: 'Salle 1' },
      size: { w: 10, h: 9 },
      pieces: [
        {
          id: 'mob1', kind: 'mob', cell: { x: 2, y: 4 }, invulnerable: true,
          name: { es: 'Kokolosse', en: 'Kokoloss', fr: 'Kokolosse' }, // nombre pendiente: es
        },
        {
          id: 'mob2', kind: 'mob', cell: { x: 2, y: 5 }, invulnerable: true,
          name: { es: 'Psykoko', en: 'Psykoko', fr: 'PsyKoko' }, // nombre pendiente: es
        },
        {
          id: 'mob3', kind: 'mob', cell: { x: 2, y: 6 }, invulnerable: true,
          name: { es: 'Kokolérik', en: 'Kokoleric', fr: 'Kokolérik' }, // nombre pendiente: es
        },
        nodkoko({ x: 8, y: 5 }, '1 PV ↑'),
        pusher({ x: 0, y: 5 }),
        orienter({ x: 9, y: 5 }),
      ],
      condition: {
        es: 'Los 3 monstruos están invulnerables (aura verde) hasta que les alcance la explosión de una Nodkoko.',
        en: 'The 3 monsters are invulnerable (green aura) until a Nodkoko explosion reaches them.',
        fr: 'Les 3 monstres sont invulnérables (aura verte) tant qu’une explosion de Nodkoko ne les atteint pas.',
      },
      duration: {
        es: 'La guía no indica que vuelvan a ser invulnerables tras la explosión.',
        en: 'The guide does not say they become invulnerable again after the explosion.',
        fr: 'Le guide n’indique pas qu’ils redeviennent invulnérables après l’explosion.',
      },
      steps: [
        {
          text: {
            es: 'Situación inicial: los 3 monstruos son invulnerables; la Nodkoko tiene 1 PV y mira al norte.',
            en: 'Initial situation: the 3 monsters are invulnerable; the Nodkoko has 1 HP and faces north.',
            fr: 'Situation initiale : les 3 monstres sont invulnérables ; la Nodkoko a 1 PV et regarde vers le nord.',
          },
          changes: [],
        },
        orientStep,
        {
          actor: 'pj1',
          text: {
            es: 'El Personaje 1 empuja a los monstruos hasta dejarlos dentro del radio de 2 de la explosión (ejemplo).',
            en: 'Character 1 pushes the monsters until they are within the explosion’s radius of 2 (example).',
            fr: 'Le Personnage 1 pousse les monstres jusqu’à les placer dans le rayon de 2 de l’explosion (exemple).',
          },
          changes: [
            { type: 'move', piece: 'mob1', to: { x: 5, y: 4 }, path: [{ x: 3, y: 4 }, { x: 4, y: 4 }] },
            { type: 'move', piece: 'mob2', to: { x: 5, y: 5 }, path: [{ x: 3, y: 5 }, { x: 4, y: 5 }] },
            { type: 'move', piece: 'mob3', to: { x: 5, y: 6 }, path: [{ x: 3, y: 6 }, { x: 4, y: 6 }] },
          ],
        },
        advanceStep,
        {
          actor: 'nodkoko',
          text: {
            es: 'La Nodkoko (0 PV) explota en radio 2 y alcanza a los 3 monstruos.',
            en: 'The Nodkoko (0 HP) explodes in radius 2 and hits all 3 monsters.',
            fr: 'La Nodkoko (0 PV) explose dans un rayon de 2 et touche les 3 monstres.',
          },
          changes: [
            { type: 'zone', zone: { kind: 'explosion', center: { x: 6, y: 5 }, radius: 2 } },
            { type: 'remove', piece: 'nodkoko' },
          ],
        },
        {
          text: {
            es: 'La invulnerabilidad de los 3 monstruos cae y ya se les puede dañar (la guía no indica que vuelva).',
            en: 'The 3 monsters lose their invulnerability and can be damaged (the guide does not say it returns).',
            fr: 'Les 3 monstres perdent leur invulnérabilité et peuvent être blessés (le guide n’indique pas qu’elle revient).',
          },
          changes: [
            { type: 'aura', piece: 'mob1', on: false },
            { type: 'aura', piece: 'mob2', on: false },
            { type: 'aura', piece: 'mob3', on: false },
          ],
        },
      ],
    },
    {
      id: 'boss',
      name: { es: 'Boss: Koko el Nutt', en: 'Boss: Koko the Nutt', fr: 'Boss : Koko le Nutt' }, // nombre pendiente: es
      size: { w: 10, h: 9 },
      pieces: [
        {
          id: 'boss', kind: 'boss', cell: { x: 2, y: 5 }, invulnerable: true,
          name: { es: 'Koko el Nutt', en: 'Koko the Nutt', fr: 'Koko le Nutt' }, // nombre pendiente: es
        },
        nodkoko({ x: 8, y: 5 }, '1 PV ↑'),
        pusher({ x: 0, y: 5 }),
        orienter({ x: 9, y: 5 }),
      ],
      condition: {
        es: 'El boss es invulnerable hasta que le alcanza una explosión de Nodkoko; solo se mueve con empujes y atracciones.',
        en: 'The boss is invulnerable until a Nodkoko explosion reaches it; it only moves by pushes and pulls.',
        fr: 'Le boss est invulnérable tant qu’une explosion de Nodkoko ne l’atteint pas ; il ne bouge que par poussées et attirances.',
      },
      duration: {
        es: '1 turno: después vuelve la invulnerabilidad y hay que repetirlo.',
        en: '1 turn: afterwards the invulnerability returns and you must repeat it.',
        fr: '1 tour : ensuite l’invulnérabilité revient et il faut recommencer.',
      },
      steps: [
        {
          text: {
            es: 'Situación inicial: el boss es invulnerable; la Nodkoko tiene 1 PV y mira al norte.',
            en: 'Initial situation: the boss is invulnerable; the Nodkoko has 1 HP and faces north.',
            fr: 'Situation initiale : le boss est invulnérable ; la Nodkoko a 1 PV et regarde vers le nord.',
          },
          changes: [],
        },
        orientStep,
        {
          actor: 'pj1',
          text: {
            es: 'El Personaje 1 empuja al boss hasta dejarlo dentro del radio de 2 de la explosión (ejemplo).',
            en: 'Character 1 pushes the boss until it is within the explosion’s radius of 2 (example).',
            fr: 'Le Personnage 1 pousse le boss jusqu’à le placer dans le rayon de 2 de l’explosion (exemple).',
          },
          changes: [{ type: 'move', piece: 'boss', to: { x: 5, y: 5 }, path: [{ x: 3, y: 5 }, { x: 4, y: 5 }] }],
        },
        advanceStep,
        {
          actor: 'nodkoko',
          text: {
            es: 'La Nodkoko (0 PV) explota en radio 2 y alcanza al boss.',
            en: 'The Nodkoko (0 HP) explodes in radius 2 and hits the boss.',
            fr: 'La Nodkoko (0 PV) explose dans un rayon de 2 et touche le boss.',
          },
          changes: [
            { type: 'zone', zone: { kind: 'explosion', center: { x: 6, y: 5 }, radius: 2 } },
            { type: 'remove', piece: 'nodkoko' },
          ],
        },
        {
          text: {
            es: 'La invulnerabilidad del boss cae y se le puede dañar durante 1 turno.',
            en: 'The boss loses its invulnerability and can be damaged for 1 turn.',
            fr: 'Le boss perd son invulnérabilité et peut être blessé pendant 1 tour.',
          },
          changes: [
            { type: 'aura', piece: 'boss', on: false },
            { type: 'counter', id: 'vuln', name: vulnTurns, value: '1' },
          ],
        },
        {
          text: {
            es: 'Pasado ese turno vuelve la invulnerabilidad: hay que repetir con otra Nodkoko.',
            en: 'After that turn the invulnerability returns: repeat with another Nodkoko.',
            fr: 'Après ce tour l’invulnérabilité revient : il faut recommencer avec une autre Nodkoko.',
          },
          changes: [
            { type: 'aura', piece: 'boss', on: true },
            { type: 'counter', id: 'vuln', name: vulnTurns, value: null },
          ],
        },
      ],
    },
  ],
};

export default d;
