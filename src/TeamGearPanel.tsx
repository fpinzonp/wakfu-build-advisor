// Sets de todo el equipo a la vez: mismo nivel para todos, tipo de set (rol y elementos) por personaje,
// y la lista conjunta de recursos: receta completa de las piezas crafteables y % de drop del resto.
import { useEffect, useMemo, useState } from 'react';
import {
  BUILD_SLOTS, CLASSES, ELEMENTS, LEVEL_BANDS, RARITIES, ROLES, bandOf, itemImage,
  type DropData, type Element, type Item, type RecipeData, type Role,
} from './lib/game';
import { recommend, type BuildSlots } from './lib/optimizer';
import { defaultChoice, expectedFights, gearRequest, teamShopping, type GearChoice } from './lib/teamGear';
import type { Member } from './lib/teams';
import { jobName, locale, mobName, t, type LangData } from './lib/i18n';
import { localizeRecipes } from './lib/localize';
import DropList from './DropList';

const classLabel = (id: string) => CLASSES.find((c) => c.id === id)!.label;
const fmt = (n: number) => n.toLocaleString(locale());
const rate = (n: number) => t('drops.rate', { n: n.toLocaleString(locale(), { maximumFractionDigits: 2 }) });

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
        out.push({ classId: p.classId, slots: recommend(items, gearRequest(p.classId, p.choice, settings)).slots });
        step(i + 1);
      }, 20);
    };
    step(0);
  };

  const shopping = useMemo(
    () => (generated ? teamShopping(generated.builds, recipes, drops) : null),
    [generated, recipes, drops],
  );

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
      lines.push(`${t('mat.raw')}:`, ...shopping.materials.materials.map((m) => `- ${m.qty}x ${name(m.id)}`));
      lines.push('', `${t('mat.copy.crafts')}:`, ...shopping.materials.crafts.map((c) =>
        `- ${c.times}x ${name(c.id)} (${jobName(c.job)} ${t('common.lvlShort', { n: c.lvl })})`));
      if (shopping.materials.plans.length) lines.push('', `${t('mat.copy.plans')}:`, ...shopping.materials.plans.map((p) => `- ${name(p)}`));
    }
    if (shopping.drops.length) {
      lines.push('', `${t('gear.dropsTitle')}:`, ...shopping.drops.map((p) => {
        const d = p.drops[0];
        return `- ${p.count}x ${p.item.name}: ${mobName(d.monster)} ${rate(d.rate)} (${t('gear.fights', { n: fmt(expectedFights(d.rate, p.count)) })})`;
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
                <select id={id} className="input" value={c.role} onChange={(e) => setChoice(m, { role: e.target.value as Role })}>
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
          <div className="tgear-builds">
            {generated.builds.map((b) => {
              const pieces = BUILD_SLOTS.map((s) => b.slots[s.id]).filter((i): i is Item => !!i);
              return (
                <details key={b.classId} className="team-tier">
                  <summary>{classLabel(b.classId)} · {t('gear.pieces', { n: pieces.length })}</summary>
                  <div className="row wrap">
                    {pieces.map((i) => <span key={i.id} className="chip" style={{ color: RARITIES[i.rarity].color }}>{i.name}</span>)}
                  </div>
                </details>
              );
            })}
          </div>

          <div className="tgear-head">
            <h3>{t('gear.recipeTitle')}</h3>
            <button className="small-btn" onClick={copy}>{copied ? t('mat.copied') : t('mat.copy')}</button>
          </div>
          <p className="muted small">{t('gear.recipeHint')}</p>
          {shopping.craft.length === 0 ? <p className="muted">{t('gear.noCraft')}</p>
            : !shopping.materials ? <p className="muted">{t('mat.loading')}</p> : (
              <div className="mat-grid">
                <div>
                  <h3>{t('mat.jobs')}</h3>
                  <div className="row wrap">
                    {shopping.materials.jobs.map((j) => <span key={j.job} className="chip">{jobName(j.job)} · {t('common.lvlShort', { n: j.lvl })}</span>)}
                  </div>
                  {shopping.materials.plans.length > 0 && (
                    <>
                      <h3>{t('mat.plans')}</h3>
                      <ul className="mat-list">{shopping.materials.plans.map((p) => <li key={p} className="plan">{name(p)}</li>)}</ul>
                    </>
                  )}
                  <details>
                    <summary>{t('mat.copy.crafts')} · {t('mat.recipes', { n: shopping.materials.crafts.length })}</summary>
                    <ul className="mat-list">
                      {shopping.materials.crafts.map((c) => (
                        <li key={c.id}>
                          <span className="qty">{fmt(c.times)}×</span> {name(c.id)}
                          <small className="muted"> {jobName(c.job)} {t('common.lvlShort', { n: c.lvl })}{c.upgrade && ` · ${t('mat.upgrade')}`}</small>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
                <div>
                  <h3>{t('mat.raw')} <small>{t('mat.distinct', { n: shopping.materials.materials.length })}</small></h3>
                  <ul className="mat-list">
                    {shopping.materials.materials.map((m) => {
                      const d = bestDrop(m.id);
                      return (
                        <li key={m.id}>
                          <img src={itemImage(gfx(m.id))} alt="" loading="lazy" referrerPolicy="no-referrer"
                            onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                          <span className="qty">{fmt(m.qty)}×</span> {name(m.id)}
                          {d && <small className="muted"> · {t('gear.materialDrop', { name: mobName(d.monster), n: rate(d.rate) })}</small>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}

          {shopping.drops.length > 0 && (
            <>
              <h3>{t('gear.dropsTitle')}</h3>
              <p className="muted small">{t('gear.dropsHint')}</p>
              <ul className="tgear-drops">
                {shopping.drops.map((p) => {
                  const best = p.drops[0];
                  return (
                    <li key={p.item.id}>
                      <div className="tgear-drop-head">
                        <img src={itemImage(p.item.gfx)} alt="" loading="lazy" referrerPolicy="no-referrer"
                          onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                        <div>
                          <b style={{ color: RARITIES[p.item.rarity].color }}>{p.count > 1 && `${p.count}× `}{p.item.name}</b>
                          <div className="muted small">{t('gear.usedBy', { names: owners(p.owners) })}</div>
                        </div>
                        <span className="tgear-rate">{rate(best.rate)}</span>
                      </div>
                      <p className="small">
                        {mobName(best.monster)}
                        <span className="muted"> · {t('gear.fights', { n: fmt(expectedFights(best.rate, p.count)) })}</span>
                      </p>
                      {p.drops.length > 1 && (
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
