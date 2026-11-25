// Sets de todo el equipo a la vez: mismo nivel para todos, tipo de set (rol y elementos) por personaje,
// y la lista conjunta de recursos: receta completa de las piezas crafteables y % de drop del resto.
import { useEffect, useMemo, useState } from 'react';
import {
  BUILD_SLOTS, CLASSES, ELEMENTS, LEVEL_BANDS, RARITIES, ROLES, STAT_LABELS, bandOf, itemImage,
  type DropData, type Element, type Item, type RecipeData, type Role,
} from './lib/game';
import { recommend, type BuildSlots } from './lib/optimizer';
import { defaultChoice, dropsToFarm, expectedFights, gearRequest, replaceOptions, stillNeeded, targetsOf, teamShopping, type GearChoice } from './lib/teamGear';
import type { Member } from './lib/teams';
import { jobName, locale, mobName, t, type LangData } from './lib/i18n';
import { localizeRecipes } from './lib/localize';
import DropList from './DropList';
import GatheredList, { CheckRow, GATHERED_KEYS, useGathered } from './GatheredList';

const classLabel = (id: string) => CLASSES.find((c) => c.id === id)!.label;
const fmt = (n: number) => n.toLocaleString(locale());
const rate = (n: number) => t('drops.rate', { n: n.toLocaleString(locale(), { maximumFractionDigits: 2 }) });

// Piezas de drop que ya se tienen (id -> unidades). Se recuerdan en este navegador.
const OWNED_KEY = 'wba.gearOwned';
function loadOwned(): Record<number, number> {
  try { return JSON.parse(localStorage.getItem(OWNED_KEY) ?? '{}') ?? {}; } catch { return {}; }
}
function saveOwned(o: Record<number, number>) {
  try { localStorage.setItem(OWNED_KEY, JSON.stringify(o)); } catch { /* sin almacenamiento local */ }
}

/** "Ya la tengo" para una unidad; contador "Tengo n / total" cuando el equipo necesita varias. */
function OwnedControl({ count, have, id, onChange }: { count: number; have: number; id: number; onChange: (n: number) => void }) {
  if (count === 1) {
    return (
      <label className="check small">
        <input type="checkbox" checked={have > 0} onChange={(e) => onChange(e.target.checked ? 1 : 0)} />
        <span>{t('gear.owned')}</span>
      </label>
    );
  }
  const inputId = `gear-owned-${id}`;
  return (
    <div className="row small">
      <label htmlFor={inputId}>{t('gear.ownedCount')}</label>
      <input id={inputId} className="input tgear-owned" type="number" min={0} max={count} value={have}
        onChange={(e) => onChange(Math.min(count, Math.max(0, +e.target.value || 0)))} />
      <span className="muted">/ {count}</span>
    </div>
  );
}

// Piezas que no se pueden conseguir: el optimizador no las vuelve a usar. Se recuerdan en este navegador.
const EXCLUDED_KEY = 'wba.gearExcluded';
function loadExcluded(): number[] {
  try { const v = JSON.parse(localStorage.getItem(EXCLUDED_KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function saveExcluded(ids: number[]) {
  try { localStorage.setItem(EXCLUDED_KEY, JSON.stringify(ids)); } catch { /* sin almacenamiento local */ }
}

interface Generated { key: string; builds: { classId: string; slots: BuildSlots }[] }

export default function TeamGearPanel({ team, items, names }: { team: Member[]; items: Item[] | null; names: LangData | null }) {
  const [level, setLevel] = useState(200);
  const [craftOnly, setCraftOnly] = useState(false);
  const [choices, setChoices] = useState<Record<string, GearChoice>>({});
  const [progress, setProgress] = useState<number | null>(null);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [recipes, setRecipes] = useState<RecipeData | null>(null);
  const [drops, setDrops] = useState<DropData | null>(null);
  const [copied, setCopied] = useState(false);
  const [owned, setOwned] = useState<Record<number, number>>(loadOwned);
  const [excluded, setExcluded] = useState<number[]>(loadExcluded);
  const [replacing, setReplacing] = useState<number | null>(null);
  const gathered = useGathered(GATHERED_KEYS.materials);
  const plansDone = useGathered(GATHERED_KEYS.plans);
  const craftsDone = useGathered(GATHERED_KEYS.crafts);

  // Recetas y drops se cargan la primera vez que se generan los sets.
  const [wantData, setWantData] = useState(false);
  useEffect(() => {
    if (!wantData) return;
    fetch(import.meta.env.BASE_URL + 'data/recipes.json').then((r) => r.json()).then(setRecipes).catch(() => undefined);
    fetch(import.meta.env.BASE_URL + 'data/drops.json').then((r) => r.json()).then(setDrops).catch(() => undefined);
  }, [wantData]);
  if (names && recipes) localizeRecipes(recipes, names);

  const choiceOf = (m: Member) => choices[m.classId] ?? defaultChoice(m.classId, m.role);
  const key = JSON.stringify({ team: team.map((m) => [m.classId, choiceOf(m)]), level, craftOnly });
  const stale = generated !== null && generated.key !== key;

  const setChoice = (m: Member, c: Partial<GearChoice>) =>
    setChoices((cur) => ({ ...cur, [m.classId]: { ...choiceOf(m), ...c } }));
  const toggleElement = (m: Member, e: Element) => {
    const els = choiceOf(m).elements;
    if (els.includes(e)) { if (els.length > 1) setChoice(m, { elements: els.filter((x) => x !== e) }); }
    else setChoice(m, { elements: [...els, e] });
  };

  // Una build por personaje, de una en una para que la interfaz muestre el avance.
  const generate = () => {
    if (!items || progress !== null) return;
    setWantData(true);
    const plan = team.map((m) => ({ classId: m.classId, choice: choiceOf(m) }));
    const out: Generated['builds'] = [];
    const settings = { level, craftOnly };
    const step = (i: number) => {
      if (i === plan.length) { setGenerated({ key, builds: out }); setProgress(null); return; }
      setProgress(i);
      setTimeout(() => {
        const p = plan[i];
        out.push({ classId: p.classId, slots: recommend(items, gearRequest(p.classId, p.choice, settings, excluded)).slots });
        step(i + 1);
      }, 20);
    };
    step(0);
  };

  // Descarta una pieza que no se puede conseguir: los personajes que la llevan se recalculan sin ella
  // conservando el resto de sus piezas, y deja de proponerse en los siguientes sets.
  const exclude = (id: number) => {
    if (!items || !generated || replacing !== null) return;
    const next = excluded.includes(id) ? excluded : [...excluded, id];
    setExcluded(next);
    saveExcluded(next);
    setReplacing(id);
    const settings = { level, craftOnly };
    setTimeout(() => {
      const builds = generated.builds.map((b) => {
        if (!Object.values(b.slots).some((i) => i?.id === id)) return b;
        const m = team.find((x) => x.classId === b.classId);
        const choice = m ? choiceOf(m) : defaultChoice(b.classId, 'dist');
        // Con un épico/reliquia se prueba también moverlo a otra ranura y se queda el mejor resultado.
        const best = replaceOptions(b.slots, id)
          .map((locked) => recommend(items, gearRequest(b.classId, choice, settings, next, locked)))
          .reduce((a, r) => (r.score > a.score ? r : a));
        return { ...b, slots: best.slots };
      });
      setGenerated({ ...generated, builds });
      setReplacing(null);
    }, 20);
  };
  const allowAgain = (id: number) => setExcluded((cur) => {
    const next = cur.filter((x) => x !== id);
    saveExcluded(next);
    return next;
  });

  const shopping = useMemo(
    () => (generated ? teamShopping(generated.builds, recipes, drops, owned) : null),
    [generated, recipes, drops, owned],
  );

  const farm = useMemo(() => (shopping ? dropsToFarm(shopping.drops, owned) : []), [shopping, owned]);
  const setOwnedCount = (id: number, n: number) => setOwned((cur) => {
    const next = { ...cur };
    if (n > 0) next[id] = n; else delete next[id];
    saveOwned(next);
    return next;
  });

  const itemById = useMemo(() => new Map(items?.map((i) => [i.id, i]) ?? []), [items]);
  // Al equipamiento se le añade la rareza: en las mejoras el objeto base tiene el mismo nombre.
  const name = (id: number) => {
    const base = recipes?.ingredients[id]?.[0] ?? itemById.get(id)?.name ?? `#${id}`;
    const rarity = recipes?.ingredients[id]?.[2] ?? itemById.get(id)?.rarity;
    return rarity === undefined ? base : `${base} (${RARITIES[rarity].label.toLowerCase()})`;
  };
  const gfx = (id: number) => recipes?.ingredients[id]?.[1] ?? itemById.get(id)?.gfx ?? 0;
  const bestDrop = (id: number) => drops?.drops[id]?.reduce((a, b) => (b.rate > a.rate ? b : a));
  const owners = (ids: string[]) => ids.map(classLabel).join(', ');

  const copy = () => {
    if (!shopping) return;
    const lines: string[] = [];
    if (shopping.materials) {
      lines.push(`${t('mat.raw')}:`, ...shopping.materials.materials.filter((m) => !gathered.isGathered(m)).map((m) => `- ${m.qty}x ${name(m.id)}`));
      lines.push('', `${t('mat.copy.crafts')}:`, ...shopping.materials.crafts.filter((c) => !craftsDone.isGathered({ id: c.id, qty: c.times })).map((c) =>
        `- ${c.times}x ${name(c.id)} (${jobName(c.job)} ${t('common.lvlShort', { n: c.lvl })})`));
      const plans = shopping.materials.plans.filter((p) => !plansDone.isGathered({ id: p, qty: 1 }));
      if (plans.length) lines.push('', `${t('mat.copy.plans')}:`, ...plans.map((p) => `- ${name(p)}`));
    }
    const pending = farm.filter((x) => x.need > 0);
    if (pending.length) {
      lines.push('', `${t('gear.dropsTitle')}:`, ...pending.map(({ piece: p, need }) => {
        const d = p.drops[0];
        return `- ${need}x ${p.item.name}: ${mobName(d.monster)} ${rate(d.rate)} (${t('gear.fights', { n: fmt(expectedFights(d.rate, need)) })})`;
      }));
    }
    if (shopping.others.length) lines.push('', `${t('gear.othersTitle')}:`, ...shopping.others.map((p) => `- ${p.count}x ${p.item.name}`));
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="panel tgear">
      <div>
        <h2>{t('gear.title')}</h2>
        <p className="muted">{t('gear.intro')}</p>
      </div>

      <div className="team-controls">
        <div className="field">
          <label htmlFor="gear-band" className="label">{t('gear.level')}</label>
          <div className="row">
            <select id="gear-band" className="input" value={bandOf(level).max} onChange={(e) => setLevel(+e.target.value)}
              aria-label={t('form.levelBand')}>
              {LEVEL_BANDS.map((b) => <option key={b.max} value={b.max}>{b.min}–{b.max}</option>)}
            </select>
            <input className="input level-input" type="number" min={1} max={245} value={level} aria-label={t('form.level')}
              onChange={(e) => setLevel(Math.min(245, Math.max(1, +e.target.value || 1)))} />
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={craftOnly} onChange={(e) => setCraftOnly(e.target.checked)} />
          <span>{t('gear.craftOnly')}<small className="muted">{t('form.craftOnly.hint')}</small></span>
        </label>
      </div>

      <ul className="tgear-members" aria-label={t('gear.setType')}>
        {team.map((m) => {
          const c = choiceOf(m);
          const cls = CLASSES.find((x) => x.id === m.classId)!;
          const id = `gear-role-${m.classId}`;
          return (
            <li key={m.classId}>
              <b className="tgear-name">{classLabel(m.classId)}</b>
              <div className="field">
                <label htmlFor={id} className="label">{t('gear.setType')}</label>
                <select id={id} className="input" value={c.role} onChange={(e) => setChoice(m, { role: e.target.value as Role, targets: undefined })}>
                  {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}{cls.roles.includes(r.id) ? '' : ' *'}</option>)}
                </select>
              </div>
              <div className="field">
                <span className="label">{t('gear.elements')}</span>
                <div className="row wrap">
                  {ELEMENTS.map((e) => (
                    <button key={e.id} type="button" className={`chip el ${c.elements.includes(e.id) ? 'on' : ''}`}
                      aria-pressed={c.elements.includes(e.id)} style={{ '--el': e.color } as React.CSSProperties}
                      onClick={() => toggleElement(m, e.id)}>
                      {e.label}{cls.elements.includes(e.id) ? '' : ' *'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <span className="label">{t('gear.targets')}</span>
                <div className="row tgear-targets">
                  {(['ap', 'mp', 'range'] as const).map((k) => {
                    const tid = `gear-${k}-${m.classId}`;
                    const cur = targetsOf(c, level);
                    return (
                      <label key={k} htmlFor={tid} className="tgear-target">
                        <span className="small muted">{STAT_LABELS[k]}</span>
                        <input id={tid} className="input" type="number" min={0} max={20} value={cur[k]}
                          onChange={(e) => setChoice(m, { targets: { ...cur, [k]: Math.min(20, Math.max(0, +e.target.value || 0)) } })} />
                      </label>
                    );
                  })}
                  {c.targets && (
                    <button type="button" className="btn ghost" onClick={() => setChoice(m, { targets: undefined })}>
                      {t('gear.targetsDefault')}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="muted small">{t('gear.usualHint')}</p>

      <div className="row wrap">
        <button type="button" className="btn primary" disabled={!items || progress !== null} onClick={generate}>
          {progress !== null ? t('gear.working', { n: progress + 1, total: team.length }) : t('gear.generate', { n: team.length })}
        </button>
        {!items && <span className="muted">{t('gear.loading')}</span>}
      </div>
      {stale && <p className="tgear-stale" role="status">{t('gear.stale')}</p>}

      {generated && shopping && (
        <>
          <h3>{t('gear.builds')}</h3>
          <p className="muted small">{t('gear.replaceHint')}</p>
          {replacing !== null && <p className="small" role="status">{t('gear.replacing', { name: itemById.get(replacing)?.name ?? `#${replacing}` })}</p>}
          <div className="tgear-builds">
            {generated.builds.map((b) => {
              const pieces = BUILD_SLOTS.map((s) => b.slots[s.id]).filter((i): i is Item => !!i);
              return (
                <details key={b.classId} className="team-tier">
                  <summary>{classLabel(b.classId)} · {t('gear.pieces', { n: pieces.length })}</summary>
                  <div className="row wrap">
                    {pieces.map((i) => (
                      <span key={i.id} className="chip tgear-piece" style={{ color: RARITIES[i.rarity].color }}>
                        {i.name}
                        <button type="button" className="tgear-swap" disabled={replacing !== null}
                          title={t('gear.replace')} aria-label={`${t('gear.replace')}: ${i.name}`} onClick={() => exclude(i.id)}>✕</button>
                      </span>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
          {excluded.length > 0 && (
            <div className="field">
              <span className="label">{t('gear.excluded')}</span>
              <div className="row wrap">
                {excluded.map((id) => (
                  <button key={id} type="button" className="chip on" title={t('form.allowAgain')} onClick={() => allowAgain(id)}>
                    {itemById.get(id)?.name ?? `#${id}`} ✕
                  </button>
                ))}
              </div>
              <small className="muted">{t('gear.excludedHint')}</small>
            </div>
          )}

          <div className="tgear-head">
            <h3>{t('gear.recipeTitle')}</h3>
            <button className="btn ghost" onClick={copy}>{copied ? t('mat.copied') : t('mat.copy')}</button>
          </div>
          <p className="muted small">{t('gear.recipeHint')}</p>
          {shopping.craft.length > 0 && (
            <>
              <p className="small" role="status">
                {t('gear.craftLeft', { n: shopping.craft.reduce((s, p) => s + stillNeeded(p, owned), 0), total: shopping.craft.reduce((s, p) => s + p.count, 0) })}
              </p>
              <ul className="tgear-crafts">
                {shopping.craft.map((p) => (
                  <li key={p.item.id} className={stillNeeded(p, owned) === 0 ? 'done' : ''}>
                    <b style={{ color: RARITIES[p.item.rarity].color }}>{p.count > 1 && `${p.count}× `}{p.item.name}</b>
                    <span className="muted small">{owners(p.owners)}</span>
                    <OwnedControl count={p.count} have={p.count - stillNeeded(p, owned)} id={p.item.id}
                      onChange={(n) => setOwnedCount(p.item.id, n)} />
                  </li>
                ))}
              </ul>
            </>
          )}
          {shopping.craft.length === 0 ? <p className="muted">{t('gear.noCraft')}</p>
            : !shopping.materials ? <p className="muted">{t('mat.loading')}</p>
            : shopping.materials.crafts.length === 0 ? <p className="muted">{t('mat.allOwned')}</p> : (
              <div className="mat-grid">
                <div>
                  <h3>{t('mat.jobs')}</h3>
                  <div className="row wrap">
                    {shopping.materials.jobs.map((j) => <span key={j.job} className="chip">{jobName(j.job)} · {t('common.lvlShort', { n: j.lvl })}</span>)}
                  </div>
                  {shopping.materials.plans.length > 0 && (
                    <>
                      <h3>{t('mat.plans')}</h3>
                      <ul className="mat-list">
                        {shopping.materials.plans.map((p) => (
                          <CheckRow key={p} className="plan" on={plansDone.isGathered({ id: p, qty: 1 })}
                            onChange={(on) => plansDone.toggle({ id: p, qty: 1 }, on)} label={t('mat.gathered', { name: name(p) })}>
                            <span className="mat-name">{name(p)}</span>
                          </CheckRow>
                        ))}
                      </ul>
                    </>
                  )}
                  <details>
                    <summary>{t('mat.copy.crafts')} · {t('mat.recipes', { n: shopping.materials.crafts.length })}</summary>
                    <ul className="mat-list">
                      {shopping.materials.crafts.map((c) => (
                        <CheckRow key={c.id} on={craftsDone.isGathered({ id: c.id, qty: c.times })}
                          onChange={(on) => craftsDone.toggle({ id: c.id, qty: c.times }, on)} label={t('mat.crafted', { name: name(c.id) })}>
                          <span className="qty">{fmt(c.times)}×</span>
                          <span className="mat-name">{name(c.id)}
                            <small className="muted"> {jobName(c.job)} {t('common.lvlShort', { n: c.lvl })}{c.upgrade && ` · ${t('mat.upgrade')}`}</small>
                          </span>
                        </CheckRow>
                      ))}
                    </ul>
                  </details>
                </div>
                <div>
                  <h3>{t('mat.raw')} <small>{t('mat.distinct', { n: shopping.materials.materials.length })}</small></h3>
                  <GatheredList materials={shopping.materials.materials} name={name} gfx={gfx} gathered={gathered}
                    extra={(id) => {
                      const d = bestDrop(id);
                      return d && <small className="muted"> · {t('gear.materialDrop', { name: mobName(d.monster), n: rate(d.rate) })}</small>;
                    }} />
                </div>
              </div>
            )}

          {shopping.drops.length > 0 && (
            <>
              <h3>{t('gear.dropsTitle')}</h3>
              <p className="muted small">{t('gear.dropsHint')}</p>
              <p className="small" role="status">
                {t('gear.dropsLeft', { n: farm.reduce((s, x) => s + x.need, 0), total: shopping.drops.reduce((s, p) => s + p.count, 0) })}
              </p>
              <ul className="tgear-drops">
                {farm.map(({ piece: p, need }) => {
                  const best = p.drops[0];
                  const have = p.count - need;
                  return (
                    <li key={p.item.id} className={need === 0 ? 'done' : ''}>
                      <div className="tgear-drop-head">
                        <img src={itemImage(p.item.gfx)} alt="" loading="lazy" referrerPolicy="no-referrer"
                          onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                        <div>
                          <b style={{ color: RARITIES[p.item.rarity].color }}>{p.count > 1 && `${p.count}× `}{p.item.name}</b>
                          <div className="muted small">{t('gear.usedBy', { names: owners(p.owners) })}</div>
                        </div>
                        <span className="tgear-rate">{need === 0 ? '✓' : rate(best.rate)}</span>
                      </div>
                      {need > 0 && (
                        <p className="small">
                          {mobName(best.monster)}
                          <span className="muted"> · {t('gear.fights', { n: fmt(expectedFights(best.rate, need)) })}</span>
                        </p>
                      )}
                      <OwnedControl count={p.count} have={have} id={p.item.id} onChange={(n) => setOwnedCount(p.item.id, n)} />
                      {need > 0 && p.drops.length > 1 && (
                        <details>
                          <summary className="small">{t('gear.allMonsters', { n: p.drops.length })}</summary>
                          <DropList drops={p.drops} />
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {shopping.others.length > 0 && (
            <>
              <h3>{t('gear.othersTitle')}</h3>
              <p className="muted small">{t('gear.othersHint')}</p>
              <div className="row wrap">
                {shopping.others.map((p) => (
                  <span key={p.item.id} className="chip" style={{ color: RARITIES[p.item.rarity].color }}>
                    {p.count > 1 && `${p.count}× `}{p.item.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
