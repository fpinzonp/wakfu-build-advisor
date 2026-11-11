import type { Dungeon, L10n, Piece } from '../types';

// Donjon Enutrosor (141-155). Fuente: https://wakfu.guide/donjons/141-155/ (sección «Donjon Enutrosor»).
// Imágenes revisadas: d526 (estado «Protection cristalline»: 400 résistance élémentaire), d530 (el mismo estado a -400),
// d527 (diamante: «Kamafluence: chaque %PV perdu retire un niveau de Protection cristalline aux [monstres]»), d524 (ficha de una
// gema, «Rubis»: sin resistencia en su elemento), d531 (bonus de daños ×, usado como ejemplo del ×5), enutrosor (portada).
// Sala 1: +400 res. a los monstres que bajan al dañar el diamante blanco; matar una de las 4 gemas da daño ×5 un turno.
// Boss: misma mecánica con el boss en lugar del diamante; un aliado en su cuerpo a cuerpo anula el daño. El % de PV del
// diamante (75 %), qué gema se mata, posiciones y nº de personajes son un ejemplo. Sin comprobar en el juego.

const T = (es: string, en: string, fr: string): L10n => ({ es, en, fr });

const x5: L10n = T('Daño ×5 (1 turno)', 'Damage ×5 (1 turn)', 'Dégâts ×5 (1 tour)');

const pj = (n: number, cell: Piece['cell']): Piece => ({
  id: `pj${n}`, kind: 'char', cell,
  name: T(`Personaje ${n}`, `Character ${n}`, `Personnage ${n}`),
});

const gem = (n: number, cell: Piece['cell']): Piece => ({
  id: `gem${n}`, kind: 'special', cell,
  name: T('Gema', 'Gem', 'Gemme'), // nombre pendiente: es, en
});

const d: Dungeon = {
  id: 'enutrosor',
  tier: [141, 155],
  name: T('Enutrosor', 'Enutrosor', 'Enutrosor'), // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/141-155/',
  rooms: [
    {
      id: 'room1',
      name: T('Sala 1', 'Room 1', 'Salle 1'),
      size: { w: 11, h: 9 },
      pieces: [
        {
          id: 'diamond', kind: 'special', cell: { x: 5, y: 4 }, label: '100 %',
          name: T('Diamante blanco', 'White diamond', 'Diamant blanc'), // nombre pendiente: es, en
        },
        gem(1, { x: 1, y: 1 }), gem(2, { x: 9, y: 1 }), gem(3, { x: 1, y: 7 }), gem(4, { x: 9, y: 7 }),
        { id: 'm1', kind: 'mob', cell: { x: 3, y: 3 }, invulnerable: true, label: '+400', name: T('Monstruo (ejemplo)', 'Monster (example)', 'Monstre (exemple)') },
        { id: 'm2', kind: 'mob', cell: { x: 7, y: 5 }, invulnerable: true, label: '+400', name: T('Monstruo (ejemplo)', 'Monster (example)', 'Monstre (exemple)') },
        pj(1, { x: 4, y: 6 }),
        pj(2, { x: 6, y: 2 }),
      ],
      condition: T(
        'Todos los monstruos tienen +400 de resistencias (aura verde). Cada % de PV que pierde el diamante blanco del centro les quita parte de ese bonus.',
        'All monsters have +400 resistances (green aura). Every % of HP the white diamond in the centre loses removes part of that bonus.',
        'Tous les monstres ont +400 résistances (aura verte). Chaque % de PV perdu par le diamant blanc au centre leur retire une partie de ce bonus.',
      ),
      duration: T(
        'Con el diamante a 50 % de PV ya no tienen bonus, y cuanto más se le pegue más bajan hasta −400 %. El diamante es muy resistente: matar una gema antes da daño ×5 durante 1 turno.',
        'With the diamond at 50% HP the bonus is gone, and the more you hit it the lower they go, down to −400%. The diamond is very tanky: killing a gem first gives ×5 damage for 1 turn.',
        'Diamant à 50 % PV : plus de bonus, et plus on le tape plus ils descendent, jusqu’à −400 %. Le diamant est très tanky : tuer une gemme avant donne des dégâts ×5 pendant 1 tour.',
      ),
      steps: [
        {
          text: T(
            'Situación inicial: los monstruos tienen +400 res. (aura verde); el diamante blanco está en el centro y hay 4 gemas.',
            'Initial situation: the monsters have +400 res. (green aura); the white diamond is in the centre and there are 4 gems.',
            'Situation initiale : les monstres ont +400 rés. (aura verte) ; le diamant blanc est au centre et il y a 4 gemmes.',
          ),
          changes: [],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 mata una gema (la que convenga): todo el daño del equipo se multiplica por 5 durante 1 turno.',
            'Character 1 kills a gem (whichever suits): the whole team’s damage is multiplied by 5 for 1 turn.',
            'Le Personnage 1 tue une gemme (celle qui arrange) : les dégâts de l’équipe sont multipliés par 5 pendant 1 tour.',
          ),
          changes: [
            { type: 'remove', piece: 'gem1' },
            { type: 'counter', id: 'x5', name: x5, value: '×5' },
          ],
        },
        {
          actor: 'pj2',
          text: T(
            'El Personaje 2 daña al diamante blanco con el ×5 (ejemplo: baja a 75 %): el bonus de los monstruos baja.',
            'Character 2 damages the white diamond with the ×5 (example: it drops to 75%): the monsters’ bonus goes down.',
            'Le Personnage 2 frappe le diamant blanc avec le ×5 (exemple : il tombe à 75 %) : le bonus des monstres baisse.',
          ),
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 4 }] } },
            { type: 'label', piece: 'diamond', label: '75 %' },
            { type: 'label', piece: 'm1', label: '+400 ↓' },
            { type: 'label', piece: 'm2', label: '+400 ↓' },
          ],
        },
        {
          text: T(
            'Acaba ese turno: el ×5 dura solo un turno, así que se vuelve a matar una gema para repetirlo.',
            'That turn ends: the ×5 lasts only one turn, so another gem is killed to repeat it.',
            'Ce tour se termine : le ×5 ne dure qu’un tour, on tue donc une autre gemme pour recommencer.',
          ),
          changes: [{ type: 'counter', id: 'x5', name: x5, value: null }],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 mata otra gema: vuelve el daño ×5 durante 1 turno.',
            'Character 1 kills another gem: the ×5 damage is back for 1 turn.',
            'Le Personnage 1 tue une autre gemme : les dégâts ×5 reviennent pendant 1 tour.',
          ),
          changes: [
            { type: 'remove', piece: 'gem2' },
            { type: 'counter', id: 'x5', name: x5, value: '×5' },
          ],
        },
        {
          actor: 'pj2',
          text: T(
            'El diamante llega a 50 % de PV: los monstruos ya no tienen bonus y dejan de ser invulnerables.',
            'The diamond reaches 50% HP: the monsters no longer have a bonus and stop being invulnerable.',
            'Le diamant arrive à 50 % de PV : les monstres n’ont plus de bonus et ne sont plus invulnérables.',
          ),
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 4 }] } },
            { type: 'label', piece: 'diamond', label: '50 %' },
            { type: 'label', piece: 'm1', label: '0' },
            { type: 'label', piece: 'm2', label: '0' },
            { type: 'aura', piece: 'm1', on: false },
            { type: 'aura', piece: 'm2', on: false },
          ],
        },
        {
          text: T(
            'Si se sigue dañando al diamante, las resistencias de los monstruos bajan hasta −400 %: se pueden matar de un golpe.',
            'If the diamond keeps being damaged, the monsters’ resistances fall down to −400%: they can be one-shot.',
            'Si on continue de frapper le diamant, les résistances des monstres descendent jusqu’à −400 % : on peut les one shot.',
          ),
          changes: [
            { type: 'counter', id: 'x5', name: x5, value: null },
            { type: 'label', piece: 'diamond', label: '<50 %' },
            { type: 'label', piece: 'm1', label: '−400' },
            { type: 'label', piece: 'm2', label: '−400' },
          ],
        },
      ],
    },
    {
      id: 'boss',
      name: T('Boss', 'Boss', 'Boss'),
      size: { w: 11, h: 9 },
      pieces: [
        {
          id: 'boss', kind: 'boss', cell: { x: 5, y: 3 }, invulnerable: true, label: '+400',
          name: T('Jefe de Enutrosor', 'Enutrosor boss', 'Boss d’Enutrosor'), // nombre pendiente: es, en, fr (la guía no lo nombra)
        },
        gem(1, { x: 1, y: 1 }), gem(2, { x: 9, y: 1 }), gem(3, { x: 1, y: 7 }), gem(4, { x: 9, y: 7 }),
        pj(1, { x: 3, y: 6 }),
        pj(2, { x: 7, y: 6 }),
        pj(3, { x: 5, y: 7 }),
      ],
      condition: T(
        'La mecánica es la misma, con el boss en lugar del diamante: sus +400 res. (aura verde) bajan al dañarlo, y matar una gema da daño ×5 sobre él durante 1 turno.',
        'The mechanic is the same, with the boss in place of the diamond: its +400 res. (green aura) go down as it is damaged, and killing a gem gives ×5 damage on it for 1 turn.',
        'La mécanique est la même, avec le boss à la place du diamant : ses +400 rés. (aura verte) baissent quand on le frappe, et tuer une gemme donne des dégâts ×5 sur lui pendant 1 tour.',
      ),
      duration: T(
        'Cuanto menos PV tiene, más fuerte pega y más bajan las resistencias de los demás monstruos: conviene centrarse en el boss. La guía no da más duraciones.',
        'The fewer HP it has, the harder it hits and the lower the other monsters’ resistances go: focusing the boss is a good idea. The guide gives no further durations.',
        'Moins il a de PV, plus il tape fort et plus les résistances des autres monstres baissent : focus le boss est une bonne idée. Le guide ne donne pas d’autres durées.',
      ),
      steps: [
        {
          text: T(
            'Situación inicial: el boss tiene +400 res. (aura verde) y hay 4 gemas en el terreno (posiciones de ejemplo).',
            'Initial situation: the boss has +400 res. (green aura) and there are 4 gems on the field (example positions).',
            'Situation initiale : le boss a +400 rés. (aura verte) et il y a 4 gemmes sur le terrain (positions d’exemple).',
          ),
          changes: [],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 mata una gema: el daño sobre el boss se multiplica por 5 durante 1 turno.',
            'Character 1 kills a gem: damage on the boss is multiplied by 5 for 1 turn.',
            'Le Personnage 1 tue une gemme : les dégâts sur le boss sont multipliés par 5 pendant 1 tour.',
          ),
          changes: [
            { type: 'remove', piece: 'gem1' },
            { type: 'counter', id: 'x5', name: x5, value: '×5' },
          ],
        },
        {
          actor: 'pj2',
          text: T(
            'El Personaje 2 daña al boss con el ×5, desde lejos: su bonus de resistencias baja.',
            'Character 2 damages the boss with the ×5, from range: its resistance bonus goes down.',
            'Le Personnage 2 frappe le boss avec le ×5, à distance : son bonus de résistances baisse.',
          ),
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 3 }] } },
            { type: 'label', piece: 'boss', label: '+400 ↓' },
          ],
        },
        {
          actor: 'pj3',
          text: T(
            'Aviso: si un aliado (Personaje 3) está al cuerpo a cuerpo del boss, los golpes que se le den no le hacen daño.',
            'Warning: if an ally (Character 3) is in the boss’s melee range, hits dealt to it do no damage.',
            'Attention : si un allié (Personnage 3) est au corps à corps du boss, les coups qu’on lui porte ne lui font aucun dégât.',
          ),
          changes: [{ type: 'move', piece: 'pj3', to: { x: 5, y: 4 }, path: [{ x: 5, y: 6 }, { x: 5, y: 5 }] }],
        },
        {
          actor: 'pj3',
          text: T(
            'Hay que evitarlo: el Personaje 3 se aparta del cuerpo a cuerpo del boss antes de que le peguen.',
            'Avoid it: Character 3 moves out of the boss’s melee range before it is hit.',
            'Il faut l’éviter : le Personnage 3 s’écarte du corps à corps du boss avant qu’on le frappe.',
          ),
          changes: [
            { type: 'move', piece: 'pj3', to: { x: 5, y: 7 }, path: [{ x: 5, y: 5 }, { x: 5, y: 6 }] },
            { type: 'counter', id: 'x5', name: x5, value: null },
          ],
        },
        {
          actor: 'pj2',
          text: T(
            'Repitiendo (gema y golpe) el bonus del boss llega a 0 y cae su protección de +400 res.',
            'Repeating (gem and hit), the boss’s bonus reaches 0 and its +400 res. protection falls.',
            'En répétant (gemme et coup), le bonus du boss arrive à 0 et sa protection de +400 rés. tombe.',
          ),
          changes: [
            { type: 'remove', piece: 'gem2' },
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 3 }] } },
            { type: 'label', piece: 'boss', label: '0' },
            { type: 'aura', piece: 'boss', on: false },
            { type: 'counter', id: 'x5', name: x5, value: '×5' },
          ],
        },
      ],
    },
  ],
};

export default d;
