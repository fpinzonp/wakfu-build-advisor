// Convierte una build abierta (ficha + baraja) en un personaje del simulador.

import { buildSheet } from '../characteristics';
import type { Element } from '../game';
import type { BuildResult } from '../optimizer';
import { fitDeck, type Deck, type Spell } from '../spells';
import type { ActorId, SimActor } from './engine';
import type { Cell } from './formulas';

export interface ActorOpts {
  classId: string; level: number; elements: Element[]; deck: Deck; spells: Spell[]; start: Cell; name: string;
}

export function actorFromBuild(id: ActorId, result: BuildResult, opts: ActorOpts): SimActor {
  const sheet = buildSheet(result, opts.elements);
  const mastery = Object.fromEntries(sheet.elements.map((e) => [e.element, e.mastery])) as Record<Element, number>;
  // Solo cuenta la baraja que cabe a este nivel y existe en la clase.
  const fitted = fitDeck(opts.deck, opts.spells, opts.level);
  const byId = new Map(opts.spells.map((s) => [s.id, s]));
  const pick = (ids: number[]) => ids.map((i) => byId.get(i)).filter((s): s is Spell => !!s);
  return {
    id, name: opts.name, classId: opts.classId, level: opts.level,
    stats: sheet.stats, mastery, maxHp: result.derived.hp,
    ap: sheet.stats.ap ?? 0, mp: sheet.stats.mp ?? 0, wp: sheet.stats.wp ?? 0,
    spells: pick(fitted.actives),
    // Las pasivas se identifican por su nombre inglés de la wiki: `name` va traducido.
    passives: pick(fitted.passives).map((s) => s.key).filter((k): k is string => !!k),
    wpPerTurn: 0,
    start: { ...opts.start },
  };
}
