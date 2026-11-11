import type { Cell } from '../../sim/formulas';
import type { Dungeon, L10n, Piece } from '../types';

// Scarrière Abandonnée (81-95). Fuente: https://wakfu.guide/donjons/81-95/ (la sección no tiene imágenes propias, solo la cabecera).
// El elemento del equipo (fuego) y las posiciones son un ejemplo; la forma real de la sala no se reproduce. Sin comprobar en el juego.

const resist: L10n = { es: 'Res. de fuego del boss', en: 'Boss fire res.', fr: 'Rés. feu du boss' };

const beetle = (id: string, cell: Cell, es: string, en: string, fr: string): Piece => ({
  id, kind: 'mob', cell,
  name: { es, en, fr }, // nombre pendiente: es, en
});

const d: Dungeon = {
  id: 'scarriere',
  tier: [81, 95],
  name: { es: 'Scarrière Abandonnée', en: 'Scarrière Abandonnée', fr: 'Scarrière Abandonnée' }, // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/81-95/',
  rooms: [
    {
      id: 'boss',
      name: { es: 'Boss', en: 'Boss', fr: 'Boss' },
      size: { w: 9, h: 7 },
      pieces: [
        {
          id: 'boss', kind: 'boss', cell: { x: 4, y: 3 }, invulnerable: true,
          name: { es: 'Boss de la Scarrière', en: 'Scarrière boss', fr: 'Boss de la Scarrière' }, // nombre pendiente: es, en, fr
        },
        beetle('fire', { x: 3, y: 1 }, 'Escarabajo de fuego pequeño', 'Small fire scarab', 'Petit scarabée de feu'),
        beetle('water', { x: 6, y: 2 }, 'Escarabajo de agua pequeño', 'Small water scarab', 'Petit scarabée d’eau'),
        beetle('earth', { x: 5, y: 5 }, 'Escarabajo de tierra pequeño', 'Small earth scarab', 'Petit scarabée de terre'),
        beetle('air', { x: 2, y: 4 }, 'Escarabajo de aire pequeño', 'Small air scarab', 'Petit scarabée d’air'),
        {
          id: 'pj1', kind: 'char', cell: { x: 1, y: 3 },
          name: { es: 'Personaje 1', en: 'Character 1', fr: 'Personnage 1' },
          role: { es: 'Juega justo después del boss', en: 'Plays right after the boss', fr: 'Joue juste après le boss' },
        },
        {
          id: 'pj2', kind: 'char', cell: { x: 7, y: 5 },
          name: { es: 'Personaje 2', en: 'Character 2', fr: 'Personnage 2' },
          role: { es: 'Mismo elemento que el equipo', en: 'Same element as the team', fr: 'Même élément que l’équipe' },
        },
      ],
      condition: {
        es: 'El boss tiene un 99 % de resistencia en los 4 elementos (aura verde). Invoca 4 escarabajos elementales al inicio de su primer turno.',
        en: 'The boss has 99% resistance in all 4 elements (green aura). It summons 4 elemental scarabs at the start of its first turn.',
        fr: 'Le boss a 99 % de résistance dans les 4 éléments (aura verte). Il invoque 4 scarabées élémentaires au début de son premier tour.',
      },
      duration: {
        es: 'Hasta que el boss vuelva a jugar. Cada escarabajo muerto le devuelve el 25 % de sus PV.',
        en: 'Until the boss plays again. Each scarab killed gives it back 25% of its HP.',
        fr: 'Jusqu’à ce que le boss rejoue. Chaque scarabée tué lui rend 25 % de ses PV.',
      },
      steps: [
        {
          text: {
            es: 'Situación inicial: boss con 99 % res. en los 4 elementos y 4 escarabajos; el equipo usa un mismo elemento (ej.: fuego).',
            en: 'Initial situation: boss with 99% res. in all 4 elements and its 4 scarabs; the team uses one element (e.g. fire).',
            fr: 'Situation initiale : boss à 99 % rés. dans les 4 éléments et 4 scarabées ; l’équipe joue un seul élément (ex. : feu).',
          },
          changes: [],
        },
        {
          actor: 'pj1',
          text: {
            es: 'El Personaje 1, que juega justo después del boss, mata el escarabajo del elemento del equipo (fuego).',
            en: 'Character 1, who plays right after the boss, kills the scarab of the team’s element (fire).',
            fr: 'Le Personnage 1, qui joue juste après le boss, tue le scarabée de l’élément de l’équipe (feu).',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 3, y: 1 }] } },
            { type: 'remove', piece: 'fire' },
          ],
        },
        {
          text: {
            es: 'El boss queda vulnerable al fuego, con 0 % de resistencia, hasta que vuelva a jugar.',
            en: 'The boss becomes vulnerable to fire, with 0% resistance, until it plays again.',
            fr: 'Le boss devient vulnérable au feu, avec 0 % de résistance, jusqu’à ce qu’il rejoue.',
          },
          changes: [
            { type: 'aura', piece: 'boss', on: false },
            { type: 'counter', id: 'res', name: resist, value: '0 %' },
          ],
        },
        {
          text: {
            es: 'Por cada escarabajo muerto el boss recupera el 25 % de sus PV.',
            en: 'For each scarab killed the boss recovers 25% of its HP.',
            fr: 'Pour chaque scarabée tué le boss récupère 25 % de ses PV.',
          },
          changes: [{ type: 'label', piece: 'boss', label: '+25 % PV' }],
        },
        {
          actor: 'pj2',
          text: {
            es: 'El resto del equipo, con el mismo elemento, ataca al boss mientras dura la debilidad.',
            en: 'The rest of the team, with the same element, attacks the boss while the weakness lasts.',
            fr: 'Le reste de l’équipe, avec le même élément, attaque le boss tant que la faiblesse dure.',
          },
          changes: [{ type: 'zone', zone: { kind: 'hit', cells: [{ x: 4, y: 3 }] } }],
        },
        {
          text: {
            es: 'Cuando el boss vuelve a jugar, recupera su 99 % de resistencia (aura verde), deducido de la guía.',
            en: 'When the boss plays again it recovers its 99% resistance (green aura), deduced from the guide.',
            fr: 'Quand le boss rejoue, il retrouve ses 99 % de résistance (aura verte), déduit du guide.',
          },
          changes: [
            { type: 'aura', piece: 'boss', on: true },
            { type: 'label', piece: 'boss', label: null },
            { type: 'counter', id: 'res', name: resist, value: null },
          ],
        },
      ],
    },
  ],
};

export default d;
