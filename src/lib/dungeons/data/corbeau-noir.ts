import type { Dungeon, L10n, Piece } from '../types';

// Antre du Corbeau Noir (96-110). Fuente: https://wakfu.guide/donjons/96-110/ (solo hay imagen de portada; la mecánica sale del
// texto «Mécanique 4»: matar un corbac da un hechizo especial en la 3.ª barra, 4 PO, y la desinvulnerabilidad dura un turno).
// Posiciones y número de personajes son un ejemplo; la forma real de la sala no se reproduce. Sin comprobar en el juego.

const turns: L10n = { es: 'Turnos sin invulnerabilidad', en: 'Turns without invulnerability', fr: 'Tours sans invulnérabilité' };
const spell: L10n = { es: 'Hechizo especial (barra 3, 4 PO)', en: 'Special spell (bar 3, 4 range)', fr: 'Sort spécial (barre 3, 4 PO)' };

const pj = (n: number, cell: Piece['cell']): Piece => ({
  id: `pj${n}`, kind: 'char', cell,
  name: { es: `Personaje ${n}`, en: `Character ${n}`, fr: `Personnage ${n}` },
});

const d: Dungeon = {
  id: 'corbeau-noir',
  tier: [96, 110],
  name: { es: 'Guarida del Cuervo Negro', en: 'Black Crow’s Lair', fr: 'Antre du Corbeau Noir' }, // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/96-110/',
  rooms: [
    {
      id: 'boss',
      name: { es: 'Boss, fase 1', en: 'Boss, phase 1', fr: 'Boss, phase 1' },
      size: { w: 11, h: 9 },
      pieces: [
        {
          id: 'boss', kind: 'boss', cell: { x: 5, y: 1 }, invulnerable: true,
          name: { es: 'Corbeau Noir', en: 'Neo Black Crow', fr: 'Corbeau Noir' }, // nombre pendiente: es
        },
        {
          id: 'corbac', kind: 'mob', cell: { x: 2, y: 4 },
          name: { es: 'Corbac', en: 'Crobak', fr: 'Corbac' }, // nombre pendiente: es, en
        },
        pj(1, { x: 3, y: 5 }),
        pj(2, { x: 5, y: 6 }),
      ],
      condition: {
        es: 'En la fase 1 el boss está arriba del mapa e invulnerable (aura verde). Matar un corbac da a todo el equipo un hechizo especial de 4 PO.',
        en: 'In phase 1 the boss is at the top of the map and invulnerable (green aura). Killing a crobak gives the whole team a special 4-range spell.',
        fr: 'En phase 1 le boss est en haut de la map et invulnérable (aura verte). Tuer un corbac donne à toute l’équipe un sort spécial de 4 PO.',
      },
      duration: {
        es: 'La invulnerabilidad cae solo durante un turno. Si no lo dejas a 1 PV en ese turno, empuja 6 casillas (no 2) y lanza un gran hechizo de zona.',
        en: 'The invulnerability falls for one turn only. If it is not brought to 1 HP that turn, it pushes 6 cells (not 2) and casts a big area spell.',
        fr: 'L’invulnérabilité ne tombe que pendant un tour. Si on ne le met pas à 1 PV ce tour, il pousse de 6 cases (au lieu de 2) et lance un gros sort de zone.',
      },
      steps: [
        {
          text: {
            es: 'Situación inicial: el boss, arriba del mapa, es invulnerable; hay un corbac en el terreno (posiciones de ejemplo).',
            en: 'Initial situation: the boss, at the top of the map, is invulnerable; there is a crobak on the field (example positions).',
            fr: 'Situation initiale : le boss, en haut de la map, est invulnérable ; il y a un corbac (positions d’exemple).',
          },
          changes: [],
        },
        {
          actor: 'pj1',
          text: {
            es: 'El Personaje 1 mata al corbac: todo el equipo recibe el hechizo especial en su tercera barra de hechizos.',
            en: 'Character 1 kills the crobak: the whole team gets the special spell in its third spell bar.',
            fr: 'Le Personnage 1 tue le corbac : toute l’équipe reçoit le sort spécial dans sa troisième barre de sorts.',
          },
          changes: [
            { type: 'remove', piece: 'corbac' },
            { type: 'counter', id: 'spell', name: spell, value: '✓' },
          ],
        },
        {
          actor: 'pj2',
          text: {
            es: 'El Personaje 2 se coloca a 4 casillas del boss o menos para poder lanzar el hechizo especial.',
            en: 'Character 2 gets within 4 cells of the boss so it can cast the special spell.',
            fr: 'Le Personnage 2 se place à 4 cases du boss ou moins pour pouvoir lancer le sort spécial.',
          },
          changes: [{ type: 'move', piece: 'pj2', to: { x: 5, y: 5 }, path: [{ x: 5, y: 6 }] }],
        },
        {
          actor: 'pj2',
          text: {
            es: 'El Personaje 2 lanza el hechizo especial sobre el boss: cae su invulnerabilidad, pero solo durante un turno.',
            en: 'Character 2 casts the special spell on the boss: its invulnerability falls, but for one turn only.',
            fr: 'Le Personnage 2 lance le sort spécial sur le boss : son invulnérabilité tombe, mais pour un tour seulement.',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 1 }] } },
            { type: 'aura', piece: 'boss', on: false },
            { type: 'counter', id: 'turns', name: turns, value: '1' },
          ],
        },
        {
          text: {
            es: 'Al acabar ese turno vuelve la invulnerabilidad: el hechizo especial solo la quita durante un turno.',
            en: 'When that turn ends the invulnerability returns: the special spell only removes it for one turn.',
            fr: 'À la fin de ce tour l’invulnérabilité revient : le sort spécial ne la retire que pendant un tour.',
          },
          changes: [
            { type: 'aura', piece: 'boss', on: true },
            { type: 'counter', id: 'turns', name: turns, value: null },
          ],
        },
      ],
    },
  ],
};

export default d;
