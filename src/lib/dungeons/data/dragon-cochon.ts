import type { Dungeon, L10n, Piece } from '../types';

// Antre du Dragon-Cochon (111-125). Fuente: https://wakfu.guide/donjons/111-125/ (solo hay imagen de portada; las mecánicas salen
// del texto: fase 1 = 30 PA «dégâts dos» (estado «mal-o-derrière») -> vulnerable 2 turnos; fase 2 = frenesí nivel 7 con 7 acciones
// distintas por turno -> vulnerable de 70 % a 30 %). La fase 3 no tiene invulnerabilidad y no se anima. Qué personaje hace cada
// acción, el reparto de PA y las posiciones son un ejemplo. Sin comprobar en el juego.

const back: L10n = { es: 'Mal-o-derrière (PA por la espalda)', en: 'Mal-o-derrière (AP in the back)', fr: 'Mal-o-derrière (PA dans le dos)' }; // nombre pendiente: es, en
const turns: L10n = { es: 'Turnos vulnerable', en: 'Turns vulnerable', fr: 'Tours vulnérable' };
const frenzy: L10n = { es: 'Frenesí', en: 'Frenzy', fr: 'Frénésie' }; // nombre pendiente: es, en

const pj = (n: number, cell: Piece['cell'], role?: L10n): Piece => ({
  id: `pj${n}`, kind: 'char', cell, ...(role ? { role } : {}),
  name: { es: `Personaje ${n}`, en: `Character ${n}`, fr: `Personnage ${n}` },
});

const boss = (): Piece => ({
  id: 'boss', kind: 'boss', cell: { x: 5, y: 3 }, invulnerable: true,
  name: { es: 'Dragocerdo', en: 'Dragon Pig', fr: 'Dragon-Cochon' },
});

const support: L10n = { es: 'Soporte', en: 'Support', fr: 'Support' };
const dps: L10n = { es: 'Daño', en: 'Damage', fr: 'Dégâts' };

const d: Dungeon = {
  id: 'dragon-cochon',
  tier: [111, 125],
  name: { es: 'Guarida del Dragón-Cerdo', en: 'Dragon Pig’s Lair', fr: 'Antre du Dragon-Cochon' }, // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/111-125/',
  rooms: [
    {
      id: 'phase1',
      name: { es: 'Fase 1 (100 % a 70 % PV)', en: 'Phase 1 (100% to 70% HP)', fr: 'Phase 1 (100 % à 70 % PV)' },
      size: { w: 9, h: 7 },
      pieces: [
        boss(),
        pj(1, { x: 7, y: 1 }, support),
        pj(2, { x: 7, y: 3 }, support),
        pj(3, { x: 7, y: 5 }, dps),
        pj(4, { x: 5, y: 6 }, support),
      ],
      condition: {
        es: 'El boss es invulnerable (aura verde). Hay que acumular 30 PA de «daños por la espalda» (estado mal-o-derrière en su ficha).',
        en: 'The boss is invulnerable (green aura). You must build up 30 AP of “back damage” (mal-o-derrière state on its sheet).',
        fr: 'Le boss est invulnérable (aura verte). Il faut cumuler 30 PA de « dégâts dos » (état mal-o-derrière sur sa fiche).',
      },
      duration: {
        es: 'Vulnerable 2 turnos (los PA por la espalda también valen a distancia); luego se ataca hasta el 70 % de PV. Los soportes juegan antes.',
        en: 'Vulnerable for 2 turns (back AP also counts at range); then attack down to 70% HP. Supports play first.',
        fr: 'Vulnérable 2 tours (les PA dans le dos comptent aussi à distance) ; puis on tape jusqu’à 70 % PV. Les supports jouent avant.',
      },
      steps: [
        {
          text: {
            es: 'Situación inicial: el boss es invulnerable; la espalda del boss está del lado del equipo (ejemplo).',
            en: 'Initial situation: the boss is invulnerable; the boss’s back faces the team (example).',
            fr: 'Situation initiale : le boss est invulnérable ; le dos du boss est du côté de l’équipe (exemple).',
          },
          changes: [],
        },
        {
          actor: 'pj1',
          text: {
            es: 'Un primer personaje (p. ej. Osamodas, Panda o Zobal) da la espalda del boss a todo el equipo.',
            en: 'A first character (e.g. Osamodas, Pandawa or Zobal) turns the boss’s back to the whole team.',
            fr: 'Un premier personnage (ex. Osamodas, Pandawa ou Zobal) donne le dos du boss à toute l’équipe.',
          },
          changes: [],
        },
        {
          actor: 'pj2',
          text: {
            es: 'El Personaje 2 (soporte) inflige PA por la espalda al boss (reparto de ejemplo: 10 de 30).',
            en: 'Character 2 (support) deals AP to the boss’s back (example split: 10 of 30).',
            fr: 'Le Personnage 2 (support) inflige des PA dans le dos du boss (répartition d’exemple : 10 sur 30).',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 3 }] } },
            { type: 'counter', id: 'back', name: back, value: '10/30' },
          ],
        },
        {
          actor: 'pj4',
          text: {
            es: 'El Personaje 4 (soporte) suma más PA por la espalda antes de que jueguen los de daño (ejemplo: 20 de 30).',
            en: 'Character 4 (support) adds more AP in the back before the damage dealers play (example: 20 of 30).',
            fr: 'Le Personnage 4 (support) ajoute des PA dans le dos avant les DPS (exemple : 20 sur 30).',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 3 }] } },
            { type: 'counter', id: 'back', name: back, value: '20/30' },
          ],
        },
        {
          actor: 'pj3',
          text: {
            es: 'El Personaje 3 (daño) completa los 30 PA por la espalda: el boss es vulnerable durante 2 turnos.',
            en: 'Character 3 (damage) completes the 30 AP in the back: the boss is vulnerable for 2 turns.',
            fr: 'Le Personnage 3 (dégâts) complète les 30 PA dans le dos : le boss est vulnérable pendant 2 tours.',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 3 }] } },
            { type: 'counter', id: 'back', name: back, value: '30/30' },
            { type: 'aura', piece: 'boss', on: false },
            { type: 'counter', id: 'turns', name: turns, value: '2' },
          ],
        },
      ],
    },
    {
      id: 'phase2',
      name: { es: 'Fase 2 (70 % a 30 % PV)', en: 'Phase 2 (70% to 30% HP)', fr: 'Phase 2 (70 % à 30 % PV)' },
      size: { w: 9, h: 7 },
      pieces: [
        boss(),
        pj(1, { x: 7, y: 1 }),
        pj(2, { x: 7, y: 3 }),
        pj(3, { x: 7, y: 5 }),
        pj(4, { x: 3, y: 6 }),
      ],
      condition: {
        es: 'Al 70 % de PV el boss vuelve a ser invulnerable (aura verde). Gana 1 nivel de frenesí por acción distinta; con nivel 7 será vulnerable.',
        en: 'At 70% HP the boss becomes invulnerable again (green aura). It gains 1 frenzy level per different action; at level 7 it becomes vulnerable.',
        fr: 'À 70 % PV le boss redevient invulnérable (aura verte). Il gagne 1 niveau de frénésie par action différente ; au niveau 7 il sera vulnérable.',
      },
      duration: {
        es: 'Vulnerable de 70 % a 30 % de PV, desde el turno del Dragocerdo. Los 7 niveles se repiten cada turno si hace falta. A 30 % vuelve a ser invulnerable hasta su siguiente turno.',
        en: 'Vulnerable from 70% to 30% HP, from the Dragon Pig’s turn. The 7 levels are repeated every turn if needed. At 30% it is invulnerable until its next turn.',
        fr: 'Vulnérable de 70 % à 30 % PV, à partir du tour du Dragon-Cochon. Les 7 niveaux se répètent à chaque tour si besoin. À 30 % il est invulnérable jusqu’à son prochain tour.',
      },
      steps: [
        {
          text: {
            es: 'Situación inicial: el boss es invulnerable y el frenesí está en 0 de 7 (personajes de ejemplo).',
            en: 'Initial situation: the boss is invulnerable and frenzy is at 0 of 7 (example characters).',
            fr: 'Situation initiale : le boss est invulnérable et la frénésie est à 0 sur 7 (personnages d’exemple).',
          },
          changes: [],
        },
        {
          actor: 'pj1',
          text: {
            es: 'El Personaje 1 golpea al boss con agua y con fuego: 2 acciones distintas (ejemplo de las 13 válidas).',
            en: 'Character 1 hits the boss with water and fire: 2 different actions (example out of the 13 valid ones).',
            fr: 'Le Personnage 1 frappe le boss à l’eau et au feu : 2 actions différentes (exemple parmi les 13 valides).',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 3 }] } },
            { type: 'counter', id: 'frenzy', name: frenzy, value: '2/7' },
          ],
        },
        {
          actor: 'pj2',
          text: {
            es: 'El Personaje 2 empuja al boss y lo cura: 2 acciones más, distintas de las anteriores (ejemplo).',
            en: 'Character 2 pushes the boss and heals it: 2 more actions, different from the previous ones (example).',
            fr: 'Le Personnage 2 pousse le boss et le soigne : 2 actions de plus, différentes des précédentes (exemple).',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 3 }] } },
            { type: 'counter', id: 'frenzy', name: frenzy, value: '4/7' },
          ],
        },
        {
          actor: 'pj3',
          text: {
            es: 'El Personaje 3 atrae al boss y le quita 1 PM: otras 2 acciones distintas (ejemplo).',
            en: 'Character 3 pulls the boss and removes 1 MP: 2 more different actions (example).',
            fr: 'Le Personnage 3 attire le boss et lui retire 1 PM : 2 autres actions différentes (exemple).',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 3 }] } },
            { type: 'counter', id: 'frenzy', name: frenzy, value: '6/7' },
          ],
        },
        {
          actor: 'pj4',
          text: {
            es: 'El Personaje 4 golpea al boss por la espalda: la séptima acción distinta, todas en el mismo turno.',
            en: 'Character 4 hits the boss in the back: the seventh different action, all within the same turn.',
            fr: 'Le Personnage 4 frappe le boss dans le dos : la septième action différente, toutes dans le même tour.',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 3 }] } },
            { type: 'counter', id: 'frenzy', name: frenzy, value: '7/7' },
          ],
        },
        {
          text: {
            es: 'Con frenesí 7, al empezar el turno del Dragocerdo el boss pierde la invulnerabilidad: se le baja de 70 % a 30 %.',
            en: 'At frenzy 7, when the Dragon Pig’s turn starts the boss loses its invulnerability: it can go from 70% to 30%.',
            fr: 'À frénésie 7, au début du tour du Dragon-Cochon le boss perd son invulnérabilité : on le descend de 70 % à 30 %.',
          },
          changes: [{ type: 'aura', piece: 'boss', on: false }],
        },
      ],
    },
  ],
};

export default d;
