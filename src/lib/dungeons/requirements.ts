import type { Need, PlaceKind } from '../teams';
import type { L10n } from './types';

export interface Requirement {
  need: Need;
  required: boolean;      // true = obligatoria; false = recomendada
  level?: 1 | 2 | 3;      // por defecto 2
  count?: number;         // personajes distintos que deben cumplirla; por defecto 1
  place?: PlaceKind;      // solo con need 'place'; ausente = cualquier subtipo
  why: L10n;              // motivo visible
}

export interface DungeonNeeds { size: 3 | 4 | 6; reqs: Requirement[] }

export const REQUIREMENTS: Record<string, DungeonNeeds> = {
  // Guía 36-50: hay que matar los 4 tentáculos para que el jefe salga del agua; vale cualquier daño. Sin exigencias.
  'poulpe': { size: 6, reqs: [] },
  // guía: «Donjon · 3 joueurs» (cabecera de la sección)
  'tour-minerale': { size: 3, reqs: [
    // guía: «Privilégiez une équipe avec pas mal de PO pour pouvoir briser les cailloux rapidement de loin»
    // (también se puede «aller taper le boss au corps-à-corps»: recomendada)
    { need: 'ranged', required: false, why: {
      es: 'Las barreras tapan la línea de visión: con alcance se rompen rápido las piedras desde lejos.',
      en: 'The barriers block line of sight: with range you break the stones quickly from afar.',
      fr: 'Les barrières bloquent la ligne de vue : avec de la PO on brise vite les cailloux de loin.',
    } },
  ] },
  'excarnus': { size: 6, reqs: [
    // guía: «il faudra les taper en mêlée seulement ou à 3PO max»; «au moins un personnage qui pourra très vite courir»
    // Recomendada: a 3 PO también vale, así que un equipo a distancia puede hacerlo.
    { need: 'melee', required: false, why: {
      es: 'Los tótems no reciben daño a distancia: hay que correr hasta ellos y pegarles cuerpo a cuerpo o a 3 PO como máximo.',
      en: 'The totems take no ranged damage: someone must run to them and hit in melee or from 3 range at most.',
      fr: 'Les totems ne prennent pas de dégâts à distance : il faut courir les taper en mêlée ou à 3 PO max.',
    } },
    // guía: «Essayez de poser -200 de résistances sur le boss rapidement après avoir tué le totem terre maudite»
    { need: 'debuff', required: false, why: {
      es: 'Tras desactivar el tótem «tierra maldita», bajar 200 res. al jefe ayuda a matarlo antes de que se reactive.',
      en: 'After disabling the cursed-earth totem, lowering the boss by 200 res. helps kill it before it reactivates.',
      fr: 'Après le totem terre maudite, poser -200 rés. au boss aide à le tuer avant qu’il ne redevienne actif.',
    } },
  ] },
  'corbeau-cave': { size: 6, reqs: [
    // guía: «Lancer des sorts de soins/boost sur les renvois de monstres vous permettra de vous soigner tout en retirant leur protection»
    // Recomendada: el daño indirecto o de zona tampoco se refleja.
    { need: 'heal', required: false, why: {
      es: 'Una cura o un boost sobre un monstruo con aura violeta le quita el reflejo y te cura.',
      en: 'A heal or boost on a monster with the purple aura removes its reflect and heals you.',
      fr: 'Un soin ou un boost sur un monstre à l’aura violette lui retire son renvoi et vous soigne.',
    } },
  ] },
  // Guía 66-80: hace falta un placador con «au moins 501 de tacle en stasis 3» junto al jefe; el placaje es de
  // equipo/estadísticas, no de clase, y no hay necesidad que lo represente. Sin exigencias.
  'truchiere': { size: 6, reqs: [] },
  // Guía 81-95: la invulnerabilidad se quita transformándose en Slek en el glifo blanco; lo hace cualquier clase. Sin exigencias.
  'slekymoses': { size: 6, reqs: [] },
  // Guía 81-95: matar el escarabajo del elemento del equipo con quien juega tras el jefe; depende del elemento y del
  // orden de turno, no de la clase. Sin exigencias.
  'scarriere': { size: 6, reqs: [] },
  // Guía 96-110: el hechizo especial lo da matar un corbac y lo usa cualquiera; los empujones del jefe se evitan
  // estabilizándose («vous pouvez vous stabiliser»). Sin exigencias.
  'corbeau-noir': { size: 6, reqs: [] },
  'arene-dansante': { size: 6, reqs: [
    // guía: «Les personnages de « dégâts mêlée » ne seront donc pas très efficaces au boss»; «prenez plutôt une team distance !»
    { need: 'ranged', required: false, why: {
      es: 'El jefe devuelve el daño salvo desde la PO de su arritmia (1 a 7): un equipo a distancia lo tiene más fácil.',
      en: 'The boss reflects damage unless hit from its arrhythmia range (1 to 7): a ranged team has it easier.',
      fr: 'Le boss renvoie les dégâts sauf depuis la PO de son arythmie (1 à 7) : une team distance s’en sort mieux.',
    } },
  ] },
  // Guía 96-110: golpear al jefe por la espalda invoca sombreros (1 por personaje y turno); lo hace cualquier clase
  // y los sombreros se acumulan entre turnos. Sin exigencias.
  'magik-riktus': { size: 6, reqs: [] },
  'hagen-glass': { size: 6, reqs: [
    // guía: «Pour briser l’armure, il faut effectuer un retrait PA»; «ayez donc une équipe avec des persos qui retirent
    // des PA ou qui effectuent facilement des sorts de poussés». Vale una u otra vía (no hay «o» entre necesidades), y la
    // armadura da resistencias, no invulnerabilidad: ambas recomendadas.
    { need: 'control', required: false, why: {
      es: 'La armadura de hielo (+250 res.) de los monstruos se rompe quitándoles PA.',
      en: 'The monsters’ ice armor (+250 res.) breaks when you remove their AP.',
      fr: 'L’armure de glace (+250 rés.) des monstres se brise en leur retirant des PA.',
    } },
    // guía: «Vous pouvez effectuer le retrait PA via un dégâts de collision»; pasos: sala 1, paso 3 (empuje contra el obstáculo)
    { need: 'place', place: 'push', required: false, why: {
      es: 'Empujar a un monstruo contra un obstáculo le quita PA por colisión y rompe su armadura de hielo.',
      en: 'Pushing a monster into an obstacle removes AP through collision and breaks its ice armor.',
      fr: 'Pousser un monstre contre un obstacle lui retire des PA par collision et brise son armure de glace.',
    } },
  ] },
  'smarrante': { size: 6, reqs: [
    // guía: «Il faut le taper au corps à corps pour lui enlever son invulnérabilité»; «une attaque ultime ... chaque tour où
    // aucun de vos personnages ne lui a infligé des dégâts au corps à corps». Golpear en contacto lo puede hacer cualquiera
    // (y tras el empuje de 5 casillas se le pega «en ligne»): recomendada.
    { need: 'melee', required: false, why: {
      es: 'Solo un golpe cuerpo a cuerpo le quita la invulnerabilidad, y si nadie le pega en contacto en un turno lanza su ultimate.',
      en: 'Only a melee hit removes its invulnerability, and if nobody hits it in melee during a turn it casts its ultimate.',
      fr: 'Seul un coup au corps à corps lui retire son invulnérabilité, et si personne ne le tape au càc dans un tour il lance son ultime.',
    } },
  ] },
  // Guía 111-125: hay que infligir 10 PA de daño de cada uno de los 4 elementos; depende de los elementos del equipo, no
  // de la clase (no hay necesidad que lo represente). Las zonas de sombra se alcanzan andando. Sin exigencias.
  'cacterre': { size: 6, reqs: [] },
  'dragon-cochon': { size: 6, reqs: [
    // guía: «il faut réaliser 7 actions différentes par tour parmi celles-ci : taper eau / taper terre / taper feu / taper air
    // / pousser le boss / soigner le boss / attirer le boss / transposer le boss / retirer un PM ... un PO ... un PA au boss /
    // taper dans le dos le boss / infliger un dégâts de poussée au boss». Hacen falta 7 de 13 (los 4 elementos no se modelan),
    // sin una combinación fija: las tres vías de clase quedan recomendadas.
    // pasos: fase 2, pasos 3 y 4 (empujar y atraer al boss)
    { need: 'place', required: false, why: {
      es: 'Fase 2: empujar, atraer o intercambiar al boss (y el daño de empuje) cuentan como acciones distintas para el frenesí 7.',
      en: 'Phase 2: pushing, pulling or swapping the boss (and push damage) count as different actions toward frenzy 7.',
      fr: 'Phase 2 : pousser, attirer ou transposer le boss (et les dégâts de poussée) comptent comme actions différentes pour la frénésie 7.',
    } },
    // pasos: fase 2, paso 4 («le retira 1 PM»)
    { need: 'control', required: false, why: {
      es: 'Fase 2: quitarle PA, PM o alcance al boss son tres acciones distintas más para llegar al frenesí 7.',
      en: 'Phase 2: removing the boss’s AP, MP or range are three more different actions toward frenzy 7.',
      fr: 'Phase 2 : retirer PA, PM ou PO au boss font trois actions différentes de plus pour la frénésie 7.',
    } },
    // guía: «soigner le boss» (acción de frenesí); «protégez au maximum tous vos personnages avec du soin et de l’amure pour
    // vous préparer à ce qui arrive en phase 3»
    { need: 'heal', required: false, why: {
      es: 'Curar al boss cuenta para el frenesí, y antes de la fase 3 hay que curar a todo el equipo.',
      en: 'Healing the boss counts toward frenzy, and before phase 3 the whole team needs healing.',
      fr: 'Soigner le boss compte pour la frénésie, et avant la phase 3 il faut soigner toute l’équipe.',
    } },
    { need: 'protect', required: false, why: {
      es: 'Al final de la fase 2 conviene poner armadura a todos: la fase 3 es devastadora.',
      en: 'At the end of phase 2, armor everyone up: phase 3 is devastating.',
      fr: 'En fin de phase 2, mettez de l’armure à tout le monde : la phase 3 est dévastatrice.',
    } },
  ] },
  'jawdin': { size: 6, reqs: [
    // guía: «Le boss doit être dans l’explosion d’une Cawotte pour perdre son invulnérabilité (pour 1 tour) : il faut donc le
    // placer proche d’une cawotte à 1PV»; pasos: sala del boss, paso 2 (el Personaje 1 coloca al boss)
    { need: 'place', required: true, why: {
      es: 'El boss solo pierde la invulnerabilidad dentro de la explosión de una Cawotte: hay que moverlo junto a una a 1 PV.',
      en: 'The boss only loses its invulnerability inside a Cawotte’s explosion: you must move it next to one at 1 HP.',
      fr: 'Le boss ne perd son invulnérabilité que dans l’explosion d’une Cawotte : il faut le placer près d’une cawotte à 1 PV.',
    } },
  ] },
  'noirespore': { size: 6, reqs: [
    // guía: «il faut tuer son invocation ... à moins de 3 PO de lui»; «Prévoyez des bons placeurs dans votre équipe pour
    // ramener l’invocation du boss à moins de 4PO de lui (l’invocation peut parfois courir n’importe où)»; pasos: boss fase 1,
    // paso 2 (el colocador trae la invocación). Sin subtipo: la guía no dice cómo traerla.
    { need: 'place', required: true, why: {
      es: 'El boss es invulnerable hasta matar su invocación a 3 casillas o menos de él, y la invocación se aleja: hay que traerla.',
      en: 'The boss is invulnerable until its summon dies within 3 cells of it, and the summon wanders off: you must bring it back.',
      fr: 'Le boss est invulnérable tant que son invocation n’est pas tuée à 3 cases ou moins de lui, et elle s’éloigne : il faut la ramener.',
    } },
  ] },
  // Guía 126-140: la protección de la fase 2 cae llevando el veneno de la Aubergine al cuerpo a cuerpo del boss; lo hace
  // cualquier personaje andando. El resto (elementos contra cada monstruo) depende del elemento, no de la clase. Sin exigencias.
  'potofeu': { size: 6, reqs: [] },
  // Guía 141-155: las resistencias bajan dañando el diamante (o el boss) tras matar una gema; vale cualquier daño del
  // elemento de la gema. «Si vous infligez des dégâts au boss alors qu’un autre de vos personnages est à son cac, il ne subira
  // aucun dégâts : évitez» es de colocación propia, no de clase. Sin exigencias.
  'enutrosor': { size: 6, reqs: [] },
  'source-du-mal': { size: 6, reqs: [
    // guía: «Résumé : tuez un bulbiflore, placez le boss dans le glyphe bleu foncé, récupérer l’état mort subite, tuez-le !»;
    // pasos: sala del boss (el Personaje 2 coloca al boss en el glifo). La invulnerabilidad cae con «Mort Subite» (ponerse a
    // la espalda de un enemigo al inicio de su turno, lo hace cualquiera); el glifo solo duplica el daño: recomendada.
    { need: 'place', required: false, why: {
      es: 'Mover al boss al glifo azul oscuro de un Bulbiflore muerto le hace recibir el doble de daño.',
      en: 'Moving the boss into a dead Bulbiflore’s dark blue glyph makes it take double damage.',
      fr: 'Placer le boss dans le glyphe bleu foncé d’un Bulbiflore mort lui fait subir le double de dégâts.',
    } },
  ] },
  // guía: «Donjon · 3 joueurs» (cabecera de la sección). Los Wabbits se matan cuando el boss les da el logo dorado y sus
  // explosiones se esquivan alejándose; nada depende de la clase. Sin exigencias.
  'wa-wabbit': { size: 3, reqs: [] },
  'e-bou': { size: 6, reqs: [
    // guía: «pour infliger des dégâts au boss, il faudra que celui-ci soit situé en dehors du carré central de la map»; «les
    // supports vont devoir replacer le boss et les cases rouges de la dernière phase avant de pouvoir taper»; pasos: fase 3,
    // paso 4 (el colocador saca al boss del cuadrado). Sin subtipo: la guía no dice cómo moverlo. Las casillas de la fase 1
    // se pisan andando y las rojas se desactivan lanzando cualquier hechizo desde ellas: no son exigencias.
    { need: 'place', required: true, why: {
      es: 'Fase 3: el boss solo recibe daño fuera del cuadrado central, y hay que recolocarlo antes de poder pegarle.',
      en: 'Phase 3: the boss only takes damage outside the central square, and it must be repositioned before you can hit it.',
      fr: 'Phase 3 : le boss ne subit des dégâts qu’en dehors du carré central, et il faut le replacer avant de pouvoir taper.',
    } },
  ] },
  'fabrique-meka': { size: 6, reqs: [
    // guía: «il faudra que vos personnages “dégâts” commencent leurs tours sur le glyphe bleu foncé central»; «Le top sera
    // donc d’avoir un personnage “placeur” qui joue juste avant votre personnage “dégâts”»; «Je vous conseil d’avoir des
    // outils de placement sur un peu tous les persos de votre team au cas où»; pasos: sala 1 y boss, paso 2 (el Personaje 2
    // coloca al Personaje 1). Consejo («le top», «je vous conseil»): recomendada.
    { need: 'place', required: false, why: {
      es: 'Los dañadores deben empezar su turno en el glifo azul oscuro, que gira: lo ideal es un colocador que juegue justo antes y los ponga en él.',
      en: 'Damage dealers must start their turn on the rotating dark blue glyph: ideally a placer playing just before them puts them on it.',
      fr: 'Les persos dégâts doivent commencer leur tour sur le glyphe bleu foncé, qui tourne : l’idéal est un placeur qui joue juste avant et les y place.',
    } },
  ] },
  'lampionaute': { size: 6, reqs: [
    // guía: «Il vous faudra tout d’abord avoir un personnage qui commence à 2 PO maximum du Cadran centrale»; «Placez
    // rapidement (avec des persos placeurs) tous vos personnages dégâts proches du cadran». Acercarse al cuadrante también se
    // puede andando: recomendada. El desplazamiento inverso hasta el boss no dice si es andando o con hechizo: se deja fuera.
    { need: 'place', required: false, why: {
      es: 'Cada dañador debe empezar su turno a 2 PO o menos del cuadrante central para obtener «Foudroyé»: los colocadores los acercan rápido.',
      en: 'Each damage dealer must start its turn within 2 range of the central dial to get “Foudroyé”: placers bring them there quickly.',
      fr: 'Chaque perso dégâts doit commencer son tour à 2 PO max du cadran central pour obtenir « Foudroyé » : les placeurs les y amènent vite.',
    } },
  ] },
  'roub-bar': { size: 6, reqs: [
    // guía: «il suffira alors de créer des lignes de murs de poudres entre vos personnages»; «d’avoir Remington dans le chemin
    // de poudre pour lui retirer son invulnérabilité»; pasos: boss, paso 5 (el Personaje 3 coloca al boss). La guía no dice que
    // haya que mover al boss (se puede alinear a los personajes a su alrededor): recomendada. «Placez une Stabilisation sur
    // Remington à la fin de phase 1» no tiene necesidad que lo represente.
    { need: 'place', required: false, why: {
      es: 'Remington pierde la invulnerabilidad en el camino de un muro de pólvora entre 2 personajes «Bombifié»: moverlo ahí ayuda.',
      en: 'Remington loses its invulnerability in the path of a powder wall between 2 “Bombifié” characters: moving it there helps.',
      fr: 'Remington perd son invulnérabilité sur le chemin d’un mur de poudre entre 2 personnages « Bombifié » : le placer dessus aide.',
    } },
  ] },
  'crocodailles': { size: 6, reqs: [
    // guía: «le donjon Croco va surtout être un donjon de placement»; el boss «le deviendra [invulnérable] quand il arrivera à
    // 55% de PV restants» y «il faudra alors lui infliger une collision»; «Le Roi Dunil est totalement indéplaçable»: la
    // colisión se hace proyectando un personaje (teletransporte, transposición, empuje, atracción…; andar no desliza) contra él.
    // pasos: boss, paso 3; sala 1, pasos 2-4. Sin subtipo: la guía acepta cualquier desplazamiento.
    { need: 'place', required: true, why: {
      es: 'Al 55 % de PV el boss (indesplazable) se vuelve invulnerable hasta chocar: hay que lanzar a un personaje contra él con un empuje, atracción o teletransporte.',
      en: 'At 55 % HP the (immovable) boss becomes invulnerable until a collision: you must throw a character into it with a push, pull or teleport.',
      fr: 'À 55 % de PV le boss (indéplaçable) devient invulnérable jusqu’à une collision : il faut projeter un personnage sur lui par poussée, attirance ou téléportation.',
    } },
  ] },
  'gerbouille': { size: 6, reqs: [
    // guía: «faites en sorte avec du retrait PM et du placement qu’elle ne puisse JAMAIS vous atteindre au corps à corps»
    // (lanza su ultimate si llega al cuerpo a cuerpo); «vous pourrez facilement l’éloignez de vos personnages (vous en aurez
    // besoin)». Es estrategia para evitar daño, no desbloqueo (la invulnerabilidad cae golpeando en melé con el estado
    // Conducteur, que da el boss): recomendadas. Quitar PW («cases bords de map … ou avec des Eca/Zobal») no se modela.
    { need: 'control', required: false, why: {
      es: 'El boss lanza su ultimate si llega a tu cuerpo a cuerpo: quitarle PM ayuda a que nunca te alcance.',
      en: 'The boss casts its ultimate if it reaches you in melee: removing its MP helps keep it from ever reaching you.',
      fr: 'Le boss lance son ultime s’il arrive à votre corps à corps : lui retirer des PM aide à ce qu’il ne vous atteigne jamais.',
    } },
    { need: 'place', required: false, why: {
      es: 'Sin invulnerabilidad el boss ya no está estabilizado: alejarlo de tus personajes evita su ultimate cuerpo a cuerpo.',
      en: 'Once vulnerable the boss is no longer stabilized: moving it away from your characters avoids its melee ultimate.',
      fr: 'Une fois vulnérable le boss n’est plus stabilisé : l’éloigner de vos personnages évite son ultime au corps à corps.',
    } },
  ] },
  'tropikes': { size: 6, reqs: [
    // guía: «Il est invulnérable tant qu’il n’a pas subi une explosion de nodkoko»; «Placez le boss près d’une nodkoko à 1PV
    // avec des poussées/attirances»; «Il n’est déplaçable qu’avec des poussées et des attirances»; sala 1: «ayez des bons
    // outils de placement». pasos: sala 1 y boss, paso 3 (el Empujador mueve a los monstruos/al boss). Subtipo empujar: la
    // guía admite empujar o atraer y el modelo no tiene «o»; sin subtipo contaría intercambio/teletransporte, que no mueven
    // al boss. Se elige el empuje (el de los pasos) para no dar por cubierto un equipo que no puede.
    { need: 'place', place: 'push', required: true, why: {
      es: 'El boss es invulnerable hasta que le alcanza la explosión de una Nodkoko a 1 PV, y solo se mueve con empujes o atracciones: hay que llevarlo cerca.',
      en: 'The boss is invulnerable until a 1 HP Nodkoko’s explosion hits it, and it only moves by pushes or pulls: you must bring it close.',
      fr: 'Le boss est invulnérable tant qu’une explosion de nodkoko à 1 PV ne le touche pas, et il ne bouge que par poussées ou attirances : il faut l’en approcher.',
    } },
  ] },
};

export const needsOf = (id: string): DungeonNeeds => {
  const n = REQUIREMENTS[id];
  if (!n) throw new Error(`Sin exigencias para la mazmorra: ${id}`);
  return n;
};
