import type { Dungeon, L10n, Piece } from '../types';

// Donjon Noirespore (126-140). Fuente: https://wakfu.guide/donjons/126-140/ (sección «Donjon Noirespore»).
// Imágenes revisadas: d451 y d454 (sala 1, Sepolourpode y trazas), d453 (Telob), d456/d457/d460 (sala del boss, trazas y
// «attendre 2 tours»), d459 (boss). Ninguna muestra nombres ni números más allá del texto. Sala 1: los 3 Sepolourpode son
// invulnerables mientras vivan los demás monstres. Boss fase 1: invulnerable hasta matar su invocación a ≤ 3 PO de él.
// Boss fase 2 (a 1 % PV): invulnerable, hay que esperar 2 turnos y que se cure 45 %. Posiciones, nº de personajes y qué
// otros monstruos hay en la sala 1 son un ejemplo. Sin comprobar en el juego.

const T = (es: string, en: string, fr: string): L10n => ({ es, en, fr });

const left: L10n = T('Otros monstruos vivos', 'Other monsters alive', 'Autres monstres en vie');
const wait: L10n = T('Turnos de espera', 'Waiting turns', 'Tours d’attente');

const pj = (n: number, cell: Piece['cell']): Piece => ({
  id: `pj${n}`, kind: 'char', cell,
  name: T(`Personaje ${n}`, `Character ${n}`, `Personnage ${n}`),
});

const sepo = (n: number, cell: Piece['cell']): Piece => ({
  id: `sepo${n}`, kind: 'mob', cell, invulnerable: true,
  name: T('Sepolourpode', 'Sepolourpode', 'Sepolourpode'), // nombre pendiente: es, en
});

const bossName = T('Jefe de Noirespore', 'Noirespore boss', 'Boss de Noirespore'); // nombre pendiente: es, en, fr (la guía no lo nombra)

const d: Dungeon = {
  id: 'noirespore',
  tier: [126, 140],
  name: T('Noirespore', 'Noirespore', 'Noirespore'), // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/126-140/',
  rooms: [
    {
      id: 'room1',
      name: T('Sala 1', 'Room 1', 'Salle 1'),
      size: { w: 11, h: 9 },
      pieces: [
        sepo(1, { x: 2, y: 2 }), sepo(2, { x: 8, y: 2 }), sepo(3, { x: 5, y: 7 }),
        { id: 'telob1', kind: 'mob', cell: { x: 4, y: 3 }, name: T('Telob', 'Telob', 'Telob') }, // nombre pendiente: es, en
        { id: 'telob2', kind: 'mob', cell: { x: 7, y: 4 }, name: T('Telob', 'Telob', 'Telob') }, // nombre pendiente: es, en
        { id: 'otro', kind: 'mob', cell: { x: 2, y: 6 }, name: T('Otro monstruo (ejemplo)', 'Other monster (example)', 'Autre monstre (exemple)') },
        pj(1, { x: 5, y: 5 }),
        pj(2, { x: 6, y: 6 }),
      ],
      condition: T(
        'Los 3 Sepolourpode son invulnerables (aura verde) mientras quede vivo cualquier otro monstruo de la sala.',
        'The 3 Sepolourpode are invulnerable (green aura) while any other monster in the room is alive.',
        'Les 3 Sepolourpode sont invulnérables (aura verte) tant qu’un autre monstre de la salle est en vie.',
      ),
      duration: T(
        'Se pueden atacar en cuanto mueren todos los demás monstruos. La guía no dice más.',
        'They can be attacked as soon as every other monster is dead. The guide says nothing more.',
        'On peut les attaquer dès que tous les autres monstres sont morts. Le guide n’en dit pas plus.',
      ),
      steps: [
        {
          text: T(
            'Situación inicial: los 3 Sepolourpode son invulnerables; hay otros monstruos vivos (posiciones de ejemplo).',
            'Initial situation: the 3 Sepolourpode are invulnerable; other monsters are alive (example positions).',
            'Situation initiale : les 3 Sepolourpode sont invulnérables ; d’autres monstres sont en vie (positions d’exemple).',
          ),
          changes: [],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 mata a un Telob (orden de ejemplo): quedan 2 monstruos que no son Sepolourpode.',
            'Character 1 kills a Telob (example order): 2 non-Sepolourpode monsters remain.',
            'Le Personnage 1 tue un Telob (ordre d’exemple) : il reste 2 monstres qui ne sont pas des Sepolourpode.',
          ),
          changes: [
            { type: 'remove', piece: 'telob1' },
            { type: 'counter', id: 'left', name: left, value: '2' },
          ],
        },
        {
          actor: 'pj2',
          text: T(
            'El Personaje 2 mata al otro Telob: queda 1 monstruo que no es Sepolourpode.',
            'Character 2 kills the other Telob: 1 non-Sepolourpode monster remains.',
            'Le Personnage 2 tue l’autre Telob : il reste 1 monstre qui n’est pas un Sepolourpode.',
          ),
          changes: [
            { type: 'remove', piece: 'telob2' },
            { type: 'counter', id: 'left', name: left, value: '1' },
          ],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 mata al último monstruo que no es Sepolourpode: los 3 Sepolourpode dejan de ser invulnerables.',
            'Character 1 kills the last non-Sepolourpode monster: the 3 Sepolourpode stop being invulnerable.',
            'Le Personnage 1 tue le dernier monstre non Sepolourpode : les 3 Sepolourpode ne sont plus invulnérables.',
          ),
          changes: [
            { type: 'remove', piece: 'otro' },
            { type: 'counter', id: 'left', name: left, value: '0' },
            { type: 'aura', piece: 'sepo1', on: false },
            { type: 'aura', piece: 'sepo2', on: false },
            { type: 'aura', piece: 'sepo3', on: false },
          ],
        },
      ],
    },
    {
      id: 'boss1',
      name: T('Boss, fase 1 (100 % a 1 % PV)', 'Boss, phase 1 (100% to 1% HP)', 'Boss, phase 1 (100 % à 1 % PV)'),
      size: { w: 11, h: 9 },
      pieces: [
        { id: 'boss', kind: 'boss', cell: { x: 5, y: 1 }, invulnerable: true, name: bossName },
        { id: 'summon', kind: 'mob', cell: { x: 9, y: 6 }, name: T('Invocación del boss', 'Boss’s summon', 'Invocation du boss') },
        pj(1, { x: 4, y: 5 }),
        pj(2, { x: 7, y: 7 }),
      ],
      condition: T(
        'El boss es invulnerable (aura verde) en toda la fase 1. Invoca a un monstruo desde el primer turno; hay que matarlo a 3 PO o menos del boss.',
        'The boss is invulnerable (green aura) for all of phase 1. It summons a monster from the first turn; it must be killed within 3 range of the boss.',
        'Le boss est invulnérable (aura verte) toute la phase 1. Il invoque un monstre dès le premier tour ; il faut le tuer à 3 PO ou moins du boss.',
      ),
      duration: T(
        'Hasta el final de la fase 1 (1 % de PV). Hacen falta buenos «placeurs» para traer la invocación, que a veces corre lejos del boss.',
        'Until the end of phase 1 (1% HP). You need good placement characters to bring the summon back, as it sometimes runs far from the boss.',
        'Jusqu’à la fin de la phase 1 (1 % PV). Il faut de bons placeurs pour ramener l’invocation, qui peut courir loin du boss.',
      ),
      steps: [
        {
          text: T(
            'Situación inicial: el boss es invulnerable y su invocación está lejos de él (posiciones de ejemplo).',
            'Initial situation: the boss is invulnerable and its summon is far from it (example positions).',
            'Situation initiale : le boss est invulnérable et son invocation est loin de lui (positions d’exemple).',
          ),
          changes: [],
        },
        {
          actor: 'pj2',
          text: T(
            'El Personaje 2 (colocador) trae la invocación hasta 3 casillas del boss o menos.',
            'Character 2 (placement) brings the summon to within 3 cells of the boss.',
            'Le Personnage 2 (placeur) ramène l’invocation à 3 cases du boss ou moins.',
          ),
          changes: [{ type: 'move', piece: 'summon', to: { x: 5, y: 4 } }],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 mata la invocación a 3 casillas o menos del boss: la invulnerabilidad cae.',
            'Character 1 kills the summon within 3 cells of the boss: the invulnerability falls.',
            'Le Personnage 1 tue l’invocation à 3 cases ou moins du boss : l’invulnérabilité tombe.',
          ),
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 4 }] } },
            { type: 'remove', piece: 'summon' },
            { type: 'aura', piece: 'boss', on: false },
          ],
        },
        {
          actor: 'pj2',
          text: T(
            'El Personaje 2 ataca al boss, ya vulnerable hasta el final de la fase 1.',
            'Character 2 attacks the boss, now vulnerable until the end of phase 1.',
            'Le Personnage 2 attaque le boss, désormais vulnérable jusqu’à la fin de la phase 1.',
          ),
          changes: [{ type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 1 }] } }],
        },
        {
          text: T(
            'El boss llega a 1 % de PV: termina la fase 1 y empieza la fase 2.',
            'The boss reaches 1% HP: phase 1 ends and phase 2 begins.',
            'Le boss atteint 1 % de PV : la phase 1 se termine et la phase 2 commence.',
          ),
          changes: [{ type: 'label', piece: 'boss', label: '1 %' }],
        },
      ],
    },
    {
      id: 'boss2',
      name: T('Boss, fase 2 (1 % a 0 PV)', 'Boss, phase 2 (1% to 0 HP)', 'Boss, phase 2 (1 % à 0 PV)'),
      size: { w: 11, h: 9 },
      pieces: [
        { id: 'boss', kind: 'boss', cell: { x: 5, y: 1 }, invulnerable: true, label: '1 %', name: bossName },
        pj(1, { x: 4, y: 5 }),
        pj(2, { x: 7, y: 6 }),
      ],
      condition: T(
        'En la fase 2 el boss vuelve a ser invulnerable (aura verde). Hay que esperar 2 turnos desde que llega a ella y que se cure un 45 % de sus PV.',
        'In phase 2 the boss is invulnerable again (green aura). You must wait 2 turns after it reaches it and for it to heal 45% of its HP.',
        'En phase 2 le boss est de nouveau invulnérable (aura verte). Il faut attendre 2 tours après qu’il l’ait atteinte et qu’il se soigne de 45 % de ses PV.',
      ),
      duration: T(
        'Tras esos 2 turnos y la cura se puede terminar el combate. Mientras tanto se matan los monstruos restantes. La guía no indica más.',
        'After those 2 turns and the heal you can finish the fight. Meanwhile kill the remaining monsters. The guide gives no more detail.',
        'Après ces 2 tours et le soin on peut finir le combat. En attendant on tue les monstres restants. Le guide n’en dit pas plus.',
      ),
      steps: [
        {
          text: T(
            'Situación inicial: el boss está a 1 % de PV y es invulnerable de nuevo (fase 2).',
            'Initial situation: the boss is at 1% HP and invulnerable again (phase 2).',
            'Situation initiale : le boss est à 1 % PV et de nouveau invulnérable (phase 2).',
          ),
          changes: [],
        },
        {
          text: T(
            'Primer turno de espera: el equipo mata a los monstruos que quedan.',
            'First waiting turn: the team kills the remaining monsters.',
            'Premier tour d’attente : l’équipe tue les monstres restants.',
          ),
          changes: [{ type: 'counter', id: 'wait', name: wait, value: '1/2' }],
        },
        {
          text: T(
            'Segundo turno de espera: el equipo sigue sin atacar al boss.',
            'Second waiting turn: the team still does not attack the boss.',
            'Deuxième tour d’attente : l’équipe n’attaque toujours pas le boss.',
          ),
          changes: [{ type: 'counter', id: 'wait', name: wait, value: '2/2' }],
        },
        {
          text: T(
            'El boss se cura un 45 % de sus PV.',
            'The boss heals 45% of its HP.',
            'Le boss se soigne de 45 % de ses PV.',
          ),
          changes: [{ type: 'label', piece: 'boss', label: '+45 %' }],
        },
        {
          actor: 'pj1',
          text: T(
            'Pasados los 2 turnos y la cura, cae su invulnerabilidad: el Personaje 1 puede terminar el combate.',
            'After the 2 turns and the heal its invulnerability falls: Character 1 can finish the fight.',
            'Après les 2 tours et le soin son invulnérabilité tombe : le Personnage 1 peut finir le combat.',
          ),
          changes: [
            { type: 'aura', piece: 'boss', on: false },
            { type: 'counter', id: 'wait', name: wait, value: null },
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 1 }] } },
          ],
        },
      ],
    },
  ],
};

export default d;
