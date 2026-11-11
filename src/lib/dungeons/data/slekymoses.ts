import type { Dungeon } from '../types';

// Caverne des Slekymoses (81-95). Fuente: https://wakfu.guide/donjons/81-95/ (imágenes d380: huevo Slek; d381: glifos claros en el suelo;
// d382: el hechizo «Baiser du Condamné», 4 PA, alcance 1, que desenvuelve la «Invulnérabilité Amoureuse» de Roubladah).
// La d381 muestra varias casillas con espiral claro; aquí se dibuja una sola casilla de ejemplo. Posiciones y número de personajes
// son un ejemplo; la forma real de la sala no se reproduce. Los huevos Slek no se animan (no son la protección). Sin comprobar en el juego.

const d: Dungeon = {
  id: 'slekymoses',
  tier: [81, 95],
  name: { es: 'Caverna de los Slekymoses', en: 'Slekymoses Cave', fr: 'Caverne des Slekymoses' }, // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/81-95/',
  rooms: [
    {
      id: 'boss',
      name: { es: 'Boss', en: 'Boss', fr: 'Boss' },
      size: { w: 9, h: 7 },
      pieces: [
        {
          id: 'boss', kind: 'boss', cell: { x: 6, y: 3 }, invulnerable: true,
          name: { es: 'Roubladah', en: 'Roubladah', fr: 'Roubladah' }, // nombre pendiente: es, en
        },
        {
          id: 'pj1', kind: 'char', cell: { x: 1, y: 5 },
          name: { es: 'Personaje 1', en: 'Character 1', fr: 'Personnage 1' },
        },
      ],
      tiles: [{ cells: [{ x: 2, y: 1 }], color: 'white' }],
      condition: {
        es: 'El boss es invulnerable (aura verde). Se quita con un hechizo cuerpo a cuerpo de 4 PA lanzado por un personaje transformado en Slek.',
        en: 'The boss is invulnerable (green aura). It is removed by a 4 AP melee spell cast by a character turned into a Slek.',
        fr: 'Le boss est invulnérable (aura verte). On la retire avec un sort de mêlée à 4 PA lancé par un personnage transformé en Slek.',
      },
      duration: {
        es: 'La guía no indica cuánto dura sin invulnerabilidad: solo dice que, una vez quitada, el boss pega fuerte y de muy lejos sin línea de visión.',
        en: 'The guide does not say how long it lasts: it only says that once removed, the boss hits hard from very far without line of sight.',
        fr: 'Le guide n’indique pas combien de temps elle dure : il dit seulement qu’une fois retirée, le boss tape fort de très loin sans ligne de vue.',
      },
      steps: [
        {
          text: {
            es: 'Situación inicial: el boss es invulnerable; hay un glifo blanco en el suelo (casilla de ejemplo).',
            en: 'Initial situation: the boss is invulnerable; there is a white glyph on the floor (example cell).',
            fr: 'Situation initiale : le boss est invulnérable ; il y a un glyphe blanc au sol (case d’exemple).',
          },
          changes: [],
        },
        {
          text: {
            es: 'El glifo blanco cambia de casilla en cada turno: hay que mirar dónde está en el turno en curso.',
            en: 'The white glyph changes cell every turn: you have to check where it is in the current turn.',
            fr: 'Le glyphe blanc change de case à chaque tour : il faut regarder où il est au tour en cours.',
          },
          changes: [
            { type: 'tiles', cells: [{ x: 2, y: 1 }], color: null },
            { type: 'tiles', cells: [{ x: 3, y: 4 }], color: 'white' },
          ],
        },
        {
          actor: 'pj1',
          text: {
            es: 'El Personaje 1 va al glifo (un hechizo Slek permite saltar hasta 5 casillas) y pasa su turno encima: se transforma en Slek.',
            en: 'Character 1 goes to the glyph (a Slek spell lets you leap up to 5 cells) and passes the turn on it: it turns into a Slek.',
            fr: 'Le Personnage 1 va sur le glyphe (un sort Slek permet de bondir à 5 cases) et passe son tour dessus : il se transforme en Slek.',
          },
          changes: [
            { type: 'move', piece: 'pj1', to: { x: 3, y: 4 } },
            { type: 'label', piece: 'pj1', label: 'Slek' },
          ],
        },
        {
          actor: 'pj1',
          text: {
            es: 'Al turno siguiente, el Personaje 1 (Slek) se pone cuerpo a cuerpo con el boss.',
            en: 'On the next turn, Character 1 (Slek) gets into melee range of the boss.',
            fr: 'Au tour suivant, le Personnage 1 (Slek) se place au corps à corps du boss.',
          },
          changes: [{ type: 'move', piece: 'pj1', to: { x: 5, y: 3 }, path: [{ x: 4, y: 4 }, { x: 4, y: 3 }] }],
        },
        {
          actor: 'pj1',
          text: {
            es: 'El Personaje 1 lanza el hechizo especial de 4 PA sobre el boss: cae su invulnerabilidad.',
            en: 'Character 1 casts the special 4 AP spell on the boss: its invulnerability falls.',
            fr: 'Le Personnage 1 lance le sort spécial à 4 PA sur le boss : son invulnérabilité tombe.',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 6, y: 3 }] } },
            { type: 'aura', piece: 'boss', on: false },
          ],
        },
        {
          actor: 'pj1',
          text: {
            es: 'Con «Manger des cailloux» el Personaje 1 vuelve a ser humano; el boss ya es vulnerable (la guía no indica cuánto dura).',
            en: 'With “Manger des cailloux” Character 1 turns human again; the boss is now vulnerable (the guide does not say for how long).',
            fr: 'Avec « Manger des cailloux » le Personnage 1 redevient humain ; le boss est vulnérable (le guide n’indique pas combien de temps).',
          },
          changes: [{ type: 'label', piece: 'pj1', label: null }],
        },
      ],
    },
  ],
};

export default d;
