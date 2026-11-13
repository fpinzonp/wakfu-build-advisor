// Los elementos de cada clase deben coincidir con los de sus hechizos (public/data/spells.json, de la wiki).
import { expect, it } from 'vitest';
import spellsJson from '../../public/data/spells.json';
import { CLASSES } from './game';

const classes = spellsJson.classes as Record<string, unknown>;
const ORDER = ['fire', 'water', 'earth', 'air'];

it.each(CLASSES.map((c) => [c.id, c.elements] as const))('%s usa los elementos de sus hechizos', (id, elements) => {
  const text = JSON.stringify(classes[id]);
  const used = ORDER.filter((el) => text.includes(`"el":"${el}"`));
  expect([...elements].sort()).toEqual([...used].sort());
});
