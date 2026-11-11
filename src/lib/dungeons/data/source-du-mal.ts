import type { Dungeon, L10n, Piece } from '../types';

// Source du Mal (141-155). Fuente: https://wakfu.guide/donjons/141-155/ (sección «Source du Mal»).
// Imágenes revisadas: d542 (Bulbiflore), d538 (glifo azul oscuro; en la imagen son unas 8 casillas, aquí 5 de ejemplo),
// d544 (ficha del estado «Mort Subite»: «Durée : 2 tours restants», pasa a 1 PV y da armadura = mitad de los PV perdidos),
// 154 (portada), d539-d541 y d543 (los otros glifos, no animados). Sin imágenes que muestren posiciones relativas: posiciones
// y personajes son un ejemplo. Mecánica animada (resumen de la guía: «tuez un bulbiflore, placez le boss dans le glyphe bleu
// foncé, récupérez l'état mort subite, tuez-le»). El boss no tiene nombre en la guía. Sin comprobar en el juego.

const T = (es: string, en: string, fr: string): L10n => ({ es, en, fr });

const state: L10n = T('Estado «Mort Subite» (1 PV + armadura)', 'Sudden Death state (1 HP + armor)', 'État « Mort Subite » (1 PV + armure)'); // nombre pendiente: es, en

const pj = (n: number, cell: Piece['cell']): Piece => ({
  id: `pj${n}`, kind: 'char', cell,
  name: T(`Personaje ${n}`, `Character ${n}`, `Personnage ${n}`),
});

const glyph = [{ x: 3, y: 5 }, { x: 2, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 4 }, { x: 3, y: 6 }];

const d: Dungeon = {
  id: 'source-du-mal',
  tier: [141, 155],
  name: T('Fuente del Mal', 'Source of Evil', 'Source du Mal'), // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/141-155/',
  rooms: [
    {
      id: 'boss',
      name: T('Boss', 'Boss', 'Boss'),
      size: { w: 11, h: 9 },
      pieces: [
        {
          id: 'boss', kind: 'boss', cell: { x: 5, y: 1 }, invulnerable: true,
          name: T('Jefe de la Fuente del Mal', 'Source of Evil boss', 'Boss de la Source du Mal'), // nombre pendiente: es, en, fr (la guía no lo nombra)
        },
        {
          id: 'bulbiflore', kind: 'mob', cell: { x: 3, y: 5 },
          name: T('Bulbiflore', 'Bulbiflor', 'Bulbiflore'), // nombre pendiente: es
        },
        pj(1, { x: 6, y: 6 }),
        pj(2, { x: 8, y: 4 }),
      ],
      condition: T(
        'El boss es invulnerable (aura verde): solo puede dañarlo quien tenga el estado «Mort Subite». Al morir un Bulbiflore queda un glifo azul oscuro (daño recibido ×2).',
        'The boss is invulnerable (green aura): only a character with the “Sudden Death” state can damage it. A dying Bulbiflor leaves a dark blue glyph (damage taken ×2).',
        'Le boss est invulnérable (aura verte) : seul un personnage avec l’état « Mort Subite » peut le blesser. À sa mort un Bulbiflore laisse un glyphe bleu foncé (dégâts subis ×2).',
      ),
      duration: T(
        'El estado dura 2 turnos (ficha de la guía) y solo se puede obtener un turno de cada 2 como máximo. Lo da cualquier enemigo al inicio de su turno a quien esté a su espalda.',
        'The state lasts 2 turns (guide’s tooltip) and can be obtained at most one turn out of 2. Any enemy gives it at its turn start to characters behind it.',
        'L’état dure 2 tours (fiche du guide) et ne s’obtient qu’un tour sur 2 au maximum. N’importe quel ennemi le donne en début de tour aux personnages dans son dos.',
      ),
      steps: [
        {
          text: T(
            'Situación inicial: el boss es invulnerable y hay un Bulbiflore en el terreno (posiciones de ejemplo).',
            'Initial situation: the boss is invulnerable and there is a Bulbiflor on the field (example positions).',
            'Situation initiale : le boss est invulnérable et il y a un Bulbiflore sur le terrain (positions d’exemple).',
          ),
          changes: [],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 mata al Bulbiflore: queda un glifo azul oscuro en su casilla (tamaño de ejemplo).',
            'Character 1 kills the Bulbiflor: a dark blue glyph is left on its cell (example size).',
            'Le Personnage 1 tue le Bulbiflore : un glyphe bleu foncé reste sur sa case (taille d’exemple).',
          ),
          changes: [
            { type: 'remove', piece: 'bulbiflore' },
            { type: 'tiles', cells: glyph, color: 'dark' },
          ],
        },
        {
          actor: 'pj2',
          text: T(
            'El Personaje 2 coloca al boss dentro del glifo azul oscuro, donde recibe el doble de daño.',
            'Character 2 places the boss inside the dark blue glyph, where it takes double damage.',
            'Le Personnage 2 place le boss dans le glyphe bleu foncé, où il subit le double de dégâts.',
          ),
          changes: [{ type: 'move', piece: 'boss', to: { x: 3, y: 4 } }],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 se coloca a la espalda del boss.',
            'Character 1 moves behind the boss.',
            'Le Personnage 1 se place dans le dos du boss.',
          ),
          changes: [{ type: 'move', piece: 'pj1', to: { x: 3, y: 3 }, path: [{ x: 6, y: 5 }, { x: 5, y: 4 }, { x: 4, y: 3 }] }],
        },
        {
          text: T(
            'Al inicio del turno de un enemigo, el Personaje 1 recibe «Mort Subite»: pasa a 1 PV y gana algo de armadura.',
            'At the start of an enemy’s turn, Character 1 gets “Sudden Death”: it drops to 1 HP and gains some armor.',
            'Au début du tour d’un ennemi, le Personnage 1 reçoit « Mort Subite » : il passe à 1 PV et gagne un peu d’armure.',
          ),
          changes: [
            { type: 'label', piece: 'pj1', label: '1 PV' },
            { type: 'counter', id: 'state', name: state, value: '✓' },
          ],
        },
        {
          actor: 'pj1',
          text: T(
            'Con «Mort Subite», el Personaje 1 sí puede dañar al boss: para él cae la invulnerabilidad (2 turnos).',
            'With “Sudden Death”, Character 1 can damage the boss: for it the invulnerability falls (2 turns).',
            'Avec « Mort Subite », le Personnage 1 peut blesser le boss : pour lui l’invulnérabilité tombe (2 tours).',
          ),
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 3, y: 4 }] } },
            { type: 'aura', piece: 'boss', on: false },
          ],
        },
      ],
    },
  ],
};

export default d;
