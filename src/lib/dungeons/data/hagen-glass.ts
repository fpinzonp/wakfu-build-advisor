import type { Dungeon, Piece } from '../types';

// Pot d'Hagen-Glass (111-125). Fuente: https://wakfu.guide/donjons/111-125/ (d421: estado «Armure de Glace», +250 resistencia
// elemental y 20 % de daños infligidos, «los retiros de PA parecen debilitarla»; d422: un monstruo rodeado de zona de ataque;
// d423/d424/d425: fases del boss, que no se animan porque no tienen invulnerabilidad). La armadura la llevan todos los monstruos;
// la sala es un ejemplo con un monstruo genérico, un obstáculo de ejemplo para la colisión y un personaje. Sin comprobar en el juego.

const pj = (n: number, cell: Piece['cell']): Piece => ({
  id: `pj${n}`, kind: 'char', cell,
  name: { es: `Personaje ${n}`, en: `Character ${n}`, fr: `Personnage ${n}` },
});

const d: Dungeon = {
  id: 'hagen-glass',
  tier: [111, 125],
  name: { es: 'Olla de Hagën-Glass', en: 'Hagën-Glass’s Pot', fr: 'Pot d’Hagen-Glass' }, // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/111-125/',
  rooms: [
    {
      id: 'room1',
      name: { es: 'Monstruos con armadura de hielo', en: 'Monsters with ice armor', fr: 'Monstres avec armure de glace' },
      size: { w: 9, h: 7 },
      pieces: [
        {
          id: 'mob1', kind: 'mob', cell: { x: 4, y: 3 }, invulnerable: true,
          name: { es: 'Monstruo (ejemplo)', en: 'Monster (example)', fr: 'Monstre (exemple)' },
        },
        pj(1, { x: 4, y: 6 }),
      ],
      tiles: [{ cells: [{ x: 4, y: 0 }], color: 'dark' }],
      condition: {
        es: 'Todos los monstruos llevan una armadura de hielo (aura verde): +250 de resistencias en todos los elementos. Se rompe quitándoles PA.',
        en: 'All monsters wear an ice armor (green aura): +250 resistances in every element. It breaks by removing their AP.',
        fr: 'Tous les monstres portent une armure de glace (aura verte) : +250 de résistances dans tous les éléments. On la brise en retirant des PA.',
      },
      duration: {
        es: 'La guía no indica cuánto dura sin armadura. Los PA se quitan con daños de colisión (empujes) o con personajes que retiran PA.',
        en: 'The guide does not say how long it lasts without armor. AP is removed with collision damage (pushes) or with AP-removal characters.',
        fr: 'Le guide n’indique pas combien de temps elle dure. Les PA se retirent par dégâts de collision (poussées) ou avec des persos retrait PA.',
      },
      steps: [
        {
          text: {
            es: 'Situación inicial: el monstruo lleva la armadura de hielo; un obstáculo oscuro de ejemplo para la colisión.',
            en: 'Initial situation: the monster wears the ice armor; a dark example obstacle for the collision.',
            fr: 'Situation initiale : le monstre porte l’armure de glace ; un obstacle sombre d’exemple pour la collision.',
          },
          changes: [],
        },
        {
          actor: 'pj1',
          text: {
            es: 'El Personaje 1 se coloca junto al monstruo, en el lado opuesto al obstáculo, con un hechizo de empuje.',
            en: 'Character 1 gets next to the monster, on the side opposite the obstacle, with a push spell.',
            fr: 'Le Personnage 1 se place près du monstre, du côté opposé à l’obstacle, avec un sort de poussée.',
          },
          changes: [{ type: 'move', piece: 'pj1', to: { x: 4, y: 4 }, path: [{ x: 4, y: 5 }] }],
        },
        {
          actor: 'pj1',
          text: {
            es: 'El Personaje 1 empuja al monstruo contra el obstáculo: choca y recibe daño de colisión.',
            en: 'Character 1 pushes the monster into the obstacle: it collides and takes collision damage.',
            fr: 'Le Personnage 1 pousse le monstre contre l’obstacle : il le heurte et subit des dégâts de collision.',
          },
          changes: [
            { type: 'move', piece: 'mob1', to: { x: 4, y: 1 }, path: [{ x: 4, y: 2 }] },
            { type: 'zone', zone: { kind: 'collision', cells: [{ x: 4, y: 0 }] } },
          ],
        },
        {
          text: {
            es: 'El daño de colisión retira PA al monstruo: se marca con «−PA».',
            en: 'The collision damage removes AP from the monster: it is marked with “−AP”.',
            fr: 'Les dégâts de collision retirent des PA au monstre : on le marque avec « −PA ».',
          },
          changes: [{ type: 'label', piece: 'mob1', label: '−PA' }],
        },
        {
          text: {
            es: 'Al quitarle PA se rompe la armadura de hielo: el monstruo pierde las +250 de resistencias (la guía no da la duración).',
            en: 'Removing AP breaks the ice armor: the monster no longer has +250 resistances (the guide gives no duration).',
            fr: 'Retirer des PA brise l’armure de glace : le monstre n’a plus +250 de résistances (le guide ne donne pas la durée).',
          },
          changes: [{ type: 'aura', piece: 'mob1', on: false }],
        },
      ],
    },
  ],
};

export default d;
