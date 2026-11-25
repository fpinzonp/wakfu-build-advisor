import { useMemo, useState } from 'react';
import { BUILD_SLOTS, RARITIES, type Item, type RecipeData } from './lib/game';
import GatheredList, { CheckRow, GATHERED_KEYS, useGathered } from './GatheredList';
import { materialsFor } from './lib/materials';
import type { BuildSlots } from './lib/optimizer';
import { jobName, locale, t } from './lib/i18n';

const fmt = (n: number) => n.toLocaleString(locale());

export default function MaterialsPanel({ slots, recipes }: { slots: BuildSlots; recipes: RecipeData | null }) {
  const [expand, setExpand] = useState(true);
  const [fullChain, setFullChain] = useState(true);
  const [owned, setOwned] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const gathered = useGathered(GATHERED_KEYS.materials);
  const plansDone = useGathered(GATHERED_KEYS.plans);
  const craftsDone = useGathered(GATHERED_KEYS.crafts);

  const pieces = BUILD_SLOTS.map((s) => slots[s.id]).filter((i): i is Item => !!i);
  const craftable = pieces.filter((i) => i.src === 'craft');
  const others = pieces.filter((i) => i.src !== 'craft');
  const toCraft = craftable.filter((i) => !owned.has(i.id));

  const list = useMemo(
    () => (recipes ? materialsFor(toCraft.map((i) => i.id), recipes, { expand, fullChain }) : null),
    // toCraft se deriva de slots y owned
    [recipes, slots, owned, expand, fullChain],
  );

  // Al equipamiento se le añade la rareza: en las mejoras el objeto base tiene el mismo nombre.
  const name = (id: number) => {
    const piece = pieces.find((p) => p.id === id);
    const base = recipes?.ingredients[id]?.[0] ?? piece?.name ?? `#${id}`;
    const rarity = recipes?.ingredients[id]?.[2] ?? piece?.rarity;
    return rarity === undefined ? base : `${base} (${RARITIES[rarity].label.toLowerCase()})`;
  };
  const gfx = (id: number) => recipes?.ingredients[id]?.[1] ?? pieces.find((p) => p.id === id)?.gfx ?? 0;

  const toggleOwned = (id: number) =>
    setOwned((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const copy = () => {
    if (!list) return;
    const lines = [
      `${t('mat.copy.materials')}:`,
      ...list.materials.filter((m) => !gathered.isGathered(m)).map((m) => `- ${m.qty}x ${name(m.id)}`),
      '',
      `${t('mat.copy.crafts')}:`,
      ...list.crafts.filter((c) => !craftsDone.isGathered({ id: c.id, qty: c.times })).map((c) => `- ${c.times}x ${name(c.id)} (${jobName(c.job)} ${t('common.lvlShort', { n: c.lvl })}${c.upgrade ? `, ${t('mat.upgrade')}` : ''})`),
    ];
    const plans = list.plans.filter((p) => !plansDone.isGathered({ id: p, qty: 1 }));
    if (plans.length) lines.push('', `${t('mat.copy.plans')}:`, ...plans.map((p) => `- ${name(p)}`));
    if (others.length) lines.push('', `${t('mat.copy.others')}:`, ...others.map((i) => `- ${i.name}`));
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="panel materials">
      <div className="mat-head">
        <h2>{t('mat.title')}</h2>
        <div className="row">
          <label className="check">
            <input type="checkbox" checked={expand} onChange={(e) => setExpand(e.target.checked)} />
            <span>{t('mat.expand')}</span>
          </label>
          <label className="check" title={t('mat.fullChain.hint')}>
            <input type="checkbox" checked={fullChain} onChange={(e) => setFullChain(e.target.checked)} />
            <span>{t('mat.fullChain')}</span>
          </label>
          <button className="btn ghost" disabled={!list} onClick={copy}>{copied ? t('mat.copied') : t('mat.copy')}</button>
        </div>
      </div>

      {craftable.length === 0 ? (
        <p className="muted">{t('mat.noneCraftable')}</p>
      ) : (
        <>
          <h3>{t('mat.pieces')} <small>{t('mat.pieces.hint')}</small></h3>
          <div className="row wrap">
            {craftable.map((i) => (
              <label key={i.id} className={`chip piece ${owned.has(i.id) ? '' : 'on'}`} style={{ color: RARITIES[i.rarity].color }}>
                <input type="checkbox" checked={!owned.has(i.id)} onChange={() => toggleOwned(i.id)} />
                {i.name}
              </label>
            ))}
          </div>

          {!list ? <p className="muted">{t('mat.loading')}</p> : toCraft.length === 0 ? (
            <p className="muted">{t('mat.allOwned')}</p>
          ) : (
            <div className="mat-grid">
              <div>
                <h3>{t('mat.jobs')}</h3>
                <div className="row wrap">
                  {list.jobs.map((j) => <span key={j.job} className="chip">{jobName(j.job)} · {t('common.lvlShort', { n: j.lvl })}</span>)}
                </div>
                {list.plans.length > 0 && (
                  <>
                    <h3>{t('mat.plans')}</h3>
                    <ul className="mat-list">
                      {list.plans.map((p) => (
                        <CheckRow key={p} className="plan" on={plansDone.isGathered({ id: p, qty: 1 })}
                          onChange={(on) => plansDone.toggle({ id: p, qty: 1 }, on)} label={t('mat.gathered', { name: name(p) })}>
                          <span className="mat-name">{name(p)}</span>
                        </CheckRow>
                      ))}
                    </ul>
                  </>
                )}
                <h3>{t('mat.copy.crafts')} <small>{t('mat.recipes', { n: list.crafts.length })}</small></h3>
                <ul className="mat-list">
                  {list.crafts.map((c) => (
                    <CheckRow key={c.id} on={craftsDone.isGathered({ id: c.id, qty: c.times })}
                      onChange={(on) => craftsDone.toggle({ id: c.id, qty: c.times }, on)} label={t('mat.crafted', { name: name(c.id) })}>
                      <span className="qty">{fmt(c.times)}×</span>
                      <span className="mat-name">{name(c.id)}
                        <small className="muted"> {jobName(c.job)} {t('common.lvlShort', { n: c.lvl })}{c.upgrade && ` · ${t('mat.upgrade')}`}</small>
                      </span>
                    </CheckRow>
                  ))}
                </ul>
              </div>
              <div>
                <h3>{expand ? t('mat.raw') : t('mat.ingredients')} <small>{t('mat.distinct', { n: list.materials.length })}</small></h3>
                <GatheredList materials={list.materials} name={name} gfx={gfx} gathered={gathered} />
              </div>
            </div>
          )}
        </>
      )}

      {others.length > 0 && (
        <>
          <h3>{t('mat.others')} <small>{t('mat.others.hint')}</small></h3>
          <div className="row wrap">
            {others.map((i) => <span key={i.id} className="chip" style={{ color: RARITIES[i.rarity].color }}>{i.name}</span>)}
          </div>
        </>
      )}
    </div>
  );
}
