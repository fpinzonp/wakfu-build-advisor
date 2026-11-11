import type { Dungeon, L10n, Piece } from '../types';

// L'Arène Dansante (96-110). Fuente: https://wakfu.guide/donjons/96-110/ (imágenes d415: ficha de la Bilby Queen con el estado
// «Respect des Pas» nivel 6, que devuelve el 100 % del daño si el lanzador no está a esa distancia; d416: un personaje atacando
// al boss con puntos verdes de distancia; d414: el estado de arritmia de un personaje). El estado 4 es el ejemplo de la guía.
// Posiciones y número de personajes son un ejemplo; la forma real de la sala no se reproduce. Sin comprobar en el juego.

const state: L10n = { es: 'Arritmia del boss (PO exacta)', en: 'Boss arrhythmia (exact range)', fr: 'Arythmie du boss (PO exacte)' };

const pj = (n: number, cell: Piece['cell']): Piece => ({
  id: `pj${n}`, kind: 'char', cell,
  name: { es: `Personaje ${n}`, en: `Character ${n}`, fr: `Personnage ${n}` },
});

const d: Dungeon = {
  id: 'arene-dansante',
  tier: [96, 110],
  name: { es: 'Arena Danzante', en: 'Dancing Arena', fr: 'L’Arène Dansante' }, // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/96-110/',
  rooms: [
    {
      id: 'boss',
      name: { es: 'Boss', en: 'Boss', fr: 'Boss' },
      size: { w: 9, h: 7 },
      pieces: [
        {
          id: 'boss', kind: 'boss', cell: { x: 5, y: 3 }, invulnerable: true,
          name: { es: 'Bilby Queen', en: 'Bilby Queen', fr: 'Bilby Queen' }, // nombre pendiente: es
        },
        pj(1, { x: 3, y: 3 }),
        pj(2, { x: 1, y: 5 }),
      ],
      condition: {
        es: 'El aura verde del boss es el reflejo: devuelve el daño salvo que se le golpee desde la PO igual a su estado de arritmia (1 a 7).',
        en: 'The boss’s green aura is the reflection: it returns the damage unless it is hit from the range equal to its arrhythmia state (1 to 7).',
        fr: 'L’aura verte du boss est le renvoi : il renvoie les dégâts sauf si on le frappe à la PO égale à son état d’arythmie (1 à 7).',
      },
      duration: {
        es: 'Se comprueba en cada ataque, no es una ventana de turnos. Los personajes de melé rinden poco: hay que esperar un estado 1 o 2.',
        en: 'It is checked on every attack, not a window of turns. Melee characters do little: wait for a state of 1 or 2.',
        fr: 'Cela se vérifie à chaque attaque, ce n’est pas une fenêtre de tours. Les persos de mêlée rendent peu : attendre un état 1 ou 2.',
      },
      steps: [
        {
          text: {
            es: 'Situación inicial: el boss refleja el daño; su estado de arritmia es 4 (ejemplo de la guía).',
            en: 'Initial situation: the boss reflects damage; its arrhythmia state is 4 (example from the guide).',
            fr: 'Situation initiale : le boss renvoie les dégâts ; son état d’arythmie est 4 (exemple du guide).',
          },
          changes: [],
        },
        {
          actor: 'pj1',
          text: {
            es: 'El Personaje 1 ataca al boss desde una PO distinta de 4 (aquí 2): el daño se le devuelve.',
            en: 'Character 1 attacks the boss from a range other than 4 (here 2): the damage is returned.',
            fr: 'Le Personnage 1 attaque le boss depuis une PO autre que 4 (ici 2) : les dégâts lui sont renvoyés.',
          },
          changes: [
            { type: 'counter', id: 'state', name: state, value: '4' },
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 3, y: 3 }] } },
          ],
        },
        {
          actor: 'pj2',
          text: {
            es: 'El Personaje 2 se coloca a exactamente 4 casillas del boss, igual que su estado de arritmia.',
            en: 'Character 2 stands exactly 4 cells from the boss, equal to its arrhythmia state.',
            fr: 'Le Personnage 2 se place à exactement 4 cases du boss, comme son état d’arythmie.',
          },
          changes: [{ type: 'move', piece: 'pj2', to: { x: 1, y: 3 }, path: [{ x: 1, y: 4 }] }],
        },
        {
          actor: 'pj2',
          text: {
            es: 'Desde esa PO el golpe no se refleja: el boss no devuelve el daño a quien lo ataca desde 4 PO.',
            en: 'From that range the hit is not reflected: the boss does not return damage to whoever attacks it from range 4.',
            fr: 'Depuis cette PO le coup n’est pas renvoyé : le boss ne renvoie pas les dégâts à qui l’attaque à 4 PO.',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 3 }] } },
            { type: 'aura', piece: 'boss', on: false },
          ],
        },
      ],
    },
  ],
};

export default d;
