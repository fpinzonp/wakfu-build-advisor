import type { Dungeon, L10n, Piece } from '../types';

// Lampionaute (156-170). Fuente: https://wakfu.guide/donjons/156-170/ (sección «Donjon Lampionaute»).
// Imágenes revisadas: d4 (ficha «Dérèglement»: invierte los desplazamientos, los magos encapuchados lo aplican; no es el
// estado que se anima), d5 (par de capturas antes/después de un desplazamiento invertido junto a un mago encapuchado),
// d6 (ficha «Foudroyé»: «Durée : 1 tour restant», «Inverse les déplacements inférieurs à 5 cases» + Javého junto al cuadrante
// central), d7 (capturas antes/después de un desplazamiento invertido con el personaje foudroyé junto a Javého y el cuadrante).
// Mecánica animada (resumen de la guía): empezar el turno a 2 PO como máximo del cuadrante central para obtener «Foudroyé»,
// hacer un desplazamiento invertido que acabe al cuerpo a cuerpo de Javého: vulnerable solo para ese personaje, 1 turno.
// La guía no da posiciones: casillas y personajes son un ejemplo. Solo se anima la sala del boss (los magos encapuchados
// no tienen invulnerabilidad). Sin comprobar en el juego.

const T = (es: string, en: string, fr: string): L10n => ({ es, en, fr });

const dial: L10n = T('Foudroyé', 'Foudroyé', 'Foudroyé'); // nombre pendiente: es, en
const vuln: L10n = T('Turnos vulnerable (solo Personaje 1)', 'Turns vulnerable (Character 1 only)', 'Tours vulnérable (Personnage 1 seul)');

const pj = (n: number, cell: Piece['cell']): Piece => ({
  id: `pj${n}`, kind: 'char', cell,
  name: T(`Personaje ${n}`, `Character ${n}`, `Personnage ${n}`),
});

const d: Dungeon = {
  id: 'lampionaute',
  tier: [156, 170],
  name: T('Lampionaute', 'Lampionaute', 'Lampionaute'), // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/156-170/',
  rooms: [
    {
      id: 'boss',
      name: T('Boss', 'Boss', 'Boss'),
      size: { w: 11, h: 9 },
      pieces: [
        {
          id: 'boss', kind: 'boss', cell: { x: 6, y: 4 }, invulnerable: true,
          name: T('Javého', 'Javého', 'Javého'), // nombre pendiente: es, en
        },
        {
          id: 'dial', kind: 'special', cell: { x: 5, y: 5 },
          name: T('Cuadrante central', 'Central dial', 'Cadran central'), // nombre pendiente: es, en
        },
        pj(1, { x: 4, y: 6 }),
      ],
      condition: T(
        'Javého es invulnerable (aura verde). Solo se le quita para un personaje que tenga «Foudroyé» y acabe un desplazamiento inverso a su cuerpo a cuerpo.',
        'Javého is invulnerable (green aura). It is only removed for a character with “Foudroyé” who ends an inverted move next to it.',
        'Javého est invulnérable (aura verte). Elle ne tombe que pour un personnage avec « Foudroyé » qui finit un déplacement inversé à son corps à corps.',
      ),
      duration: T(
        'Javého es vulnerable solo para ese personaje y solo 1 turno: hay que repetirlo con cada personaje que haga daño. En fase 3, cada ataque recibido le hace dañar a su alrededor en cuerpo a cuerpo.',
        'Javého is vulnerable only to that character and only for 1 turn: repeat it for every damage dealer. In phase 3, each hit makes it damage its melee surroundings.',
        'Javého n’est vulnérable que pour ce personnage et 1 seul tour : à refaire pour chaque personnage de dégâts. En phase 3, chaque attaque lui fait infliger des dégâts autour de lui en mêlée.',
      ),
      steps: [
        {
          text: T(
            'Situación inicial: Javého es invulnerable; el Personaje 1 está cerca del cuadrante central (posiciones de ejemplo).',
            'Initial situation: Javého is invulnerable; Character 1 is near the central dial (example positions).',
            'Situation initiale : Javého est invulnérable ; le Personnage 1 est près du cadran central (positions d’exemple).',
          ),
          changes: [],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 empieza su turno a 2 PO o menos del cuadrante central y recibe «Foudroyé».',
            'Character 1 starts its turn within 2 range of the central dial and gets “Foudroyé”.',
            'Le Personnage 1 commence son tour à 2 PO ou moins du cadran central et reçoit « Foudroyé ».',
          ),
          changes: [
            { type: 'zone', zone: { kind: 'glyph', center: { x: 5, y: 5 }, radius: 2 } },
            { type: 'label', piece: 'pj1', label: '⚡' },
            { type: 'counter', id: 'state', name: dial, value: '1' },
          ],
        },
        {
          actor: 'pj1',
          text: T(
            'Foudroyé invierte sus desplazamientos: el Personaje 1 ordena ir hacia un lado y acaba en el opuesto (ejemplo).',
            'Foudroyé inverts its movements: Character 1 orders a move one way and ends on the opposite side (example).',
            'Foudroyé inverse ses déplacements : le Personnage 1 ordonne un côté et finit du côté opposé (exemple).',
          ),
          changes: [
            { type: 'move', piece: 'pj1', to: { x: 6, y: 5 }, path: [{ x: 5, y: 6 }, { x: 6, y: 6 }] },
          ],
        },
        {
          text: T(
            'El Personaje 1 acaba al cuerpo a cuerpo de Javého: cae su invulnerabilidad, solo para él y solo 1 turno.',
            'Character 1 ends next to Javého: its invulnerability falls, for Character 1 only and for 1 turn only.',
            'Le Personnage 1 finit au corps à corps de Javého : son invulnérabilité tombe, pour lui seul et 1 tour seulement.',
          ),
          changes: [
            { type: 'aura', piece: 'boss', on: false },
            { type: 'counter', id: 'vuln', name: vuln, value: '1' },
          ],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 ataca a Javého durante ese turno.',
            'Character 1 attacks Javého during that turn.',
            'Le Personnage 1 attaque Javého pendant ce tour.',
          ),
          changes: [{ type: 'zone', zone: { kind: 'hit', cells: [{ x: 6, y: 4 }] } }],
        },
        {
          text: T(
            'Pasado el turno Javého vuelve a ser invulnerable para el Personaje 1 (deducido) y debe repetirlo.',
            'After the turn Javého is invulnerable again to Character 1 (deduced) and it must repeat the process.',
            'Après le tour Javého redevient invulnérable pour le Personnage 1 (déduit) et il doit recommencer.',
          ),
          changes: [
            { type: 'aura', piece: 'boss', on: true },
            { type: 'label', piece: 'pj1', label: null },
            { type: 'counter', id: 'state', name: dial, value: null },
            { type: 'counter', id: 'vuln', name: vuln, value: null },
          ],
        },
      ],
    },
  ],
};

export default d;
