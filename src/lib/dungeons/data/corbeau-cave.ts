import type { Dungeon, L10n, Piece } from '../types';

// La Corbeau-Cave (66-80). Fuente: https://wakfu.guide/donjons/66-80/ (imágenes d356: aura violeta; d355: glifos del boss, no animados).
// La guía describe la mecánica de los monstruos en general (sin salas separadas): se anima un monstruo de ejemplo.
// Posiciones y número de personajes son un ejemplo; la forma real de la sala no se reproduce. Sin comprobar en el juego.

const hits: L10n = { es: 'Ataques recibidos', en: 'Attacks received', fr: 'Attaques reçues' };

const pj = (n: number, cell: Piece['cell'], role?: L10n): Piece => ({
  id: `pj${n}`, kind: 'char', cell, role,
  name: { es: `Personaje ${n}`, en: `Character ${n}`, fr: `Personnage ${n}` },
});

const d: Dungeon = {
  id: 'corbeau-cave',
  tier: [66, 80],
  name: { es: 'Corbeau-Cave', en: 'Corbeau-Cave', fr: 'La Corbeau-Cave' }, // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/66-80/',
  rooms: [
    {
      id: 'room1',
      name: { es: 'Cualquier sala', en: 'Any room', fr: 'N’importe quelle salle' },
      size: { w: 7, h: 5 },
      pieces: [
        {
          id: 'mob1', kind: 'mob', cell: { x: 3, y: 2 },
          name: { es: 'Corbeau', en: 'Corbeau', fr: 'Corbeau' }, // nombre pendiente: es, en
        },
        pj(1, { x: 1, y: 2 }),
        pj(2, { x: 3, y: 4 }, { es: 'Cura o boost', en: 'Heal or boost', fr: 'Soin ou boost' }),
      ],
      condition: {
        es: 'Cada 5 ataques recibidos, el monstruo devuelve el 6.º (aura violeta): la protección es el reflejo. Daño indirecto y de zona no se reflejan.',
        en: 'After every 5 attacks received, the monster reflects the 6th (purple aura): the protection is the reflection. Indirect and area damage are not reflected.',
        fr: 'Toutes les 5 attaques reçues, le monstre renvoie la 6e (aura violette) : la protection est le renvoi. Les dégâts indirects et de zone ne sont pas renvoyés.',
      },
      duration: {
        es: 'La guía no indica cuánto dura la protección ni cuándo se reinicia la cuenta de ataques.',
        en: 'The guide does not say how long the protection lasts or when the attack count restarts.',
        fr: 'Le guide n’indique pas combien de temps dure la protection ni quand le compte d’attaques recommence.',
      },
      steps: [
        {
          text: {
            es: 'Situación inicial: un monstruo de la Corbeau-Cave sin protección y sin ataques recibidos.',
            en: 'Initial situation: a Corbeau-Cave monster with no protection and no attacks received.',
            fr: 'Situation initiale : un monstre de la Corbeau-Cave sans protection et sans attaque reçue.',
          },
          changes: [],
        },
        {
          actor: 'pj1',
          text: {
            es: 'El Personaje 1 ataca al monstruo hasta acumular 5 ataques recibidos.',
            en: 'Character 1 attacks the monster until it has received 5 attacks.',
            fr: 'Le Personnage 1 attaque le monstre jusqu’à lui faire subir 5 attaques.',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 3, y: 2 }] } },
            { type: 'counter', id: 'hits', name: hits, value: '5' },
          ],
        },
        {
          text: {
            es: 'El monstruo toma aura violeta: el siguiente hechizo que reciba será devuelto a quien lo lance.',
            en: 'The monster takes a purple aura: the next spell it receives is sent back to its caster.',
            fr: 'Le monstre prend une aura violette : le prochain sort reçu sera renvoyé à son lanceur.',
          },
          changes: [
            { type: 'aura', piece: 'mob1', on: true },
            { type: 'label', piece: 'mob1', label: '↩' },
            { type: 'counter', id: 'hits', name: hits, value: '6 ↩' },
          ],
        },
        {
          actor: 'pj1',
          text: {
            es: 'Un daño de zona o indirecto, sin apuntar al monstruo, lo atraviesa: no se refleja (la protección sigue).',
            en: 'Area or indirect damage not aimed at the monster goes through: it is not reflected (protection stays).',
            fr: 'Un dégât de zone ou indirect, sans viser le monstre, passe à travers : pas de renvoi (la protection reste).',
          },
          changes: [{ type: 'zone', zone: { kind: 'hit', center: { x: 3, y: 2 }, radius: 1 } }],
        },
        {
          actor: 'pj2',
          text: {
            es: 'El Personaje 2 lanza un hechizo de cura o boost sobre el monstruo: el reflejo cura o refuerza a quien lo lanza.',
            en: 'Character 2 casts a heal or boost spell on the monster: the reflection heals or boosts the caster.',
            fr: 'Le Personnage 2 lance un sort de soin ou de boost sur le monstre : le renvoi soigne ou booste le lanceur.',
          },
          changes: [{ type: 'zone', zone: { kind: 'hit', cells: [{ x: 3, y: 2 }] } }],
        },
        {
          text: {
            es: 'El reflejo se ha gastado: el monstruo pierde la protección (la guía no indica cuánto dura).',
            en: 'The reflection is spent: the monster loses its protection (the guide does not say for how long).',
            fr: 'Le renvoi est consommé : le monstre perd sa protection (le guide n’indique pas combien de temps).',
          },
          changes: [
            { type: 'aura', piece: 'mob1', on: false },
            { type: 'label', piece: 'mob1', label: null },
            { type: 'counter', id: 'hits', name: hits, value: null },
          ],
        },
      ],
    },
  ],
};

export default d;
