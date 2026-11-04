import { useMemo, useState } from 'react';
import { BUILD_SLOTS, RARITIES, itemImage, type Item, type RecipeData } from './lib/game';
import { materialsFor } from './lib/materials';
import type { BuildSlots } from './lib/optimizer';
import { jobName, locale, t } from './lib/i18n';

const fmt = (n: number) => n.toLocaleString(locale());

export default function MaterialsPanel({ slots, recipes }: { slots: BuildSlots; recipes: RecipeData | null }) {
  const [expand, setExpand] = useState(true);
  const [fullChain, setFullChain] = useState(true);
  const [owned, setOwned] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

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
      ...list.materials.map((m) => `- ${m.qty}x ${name(m.id)}`),
      '',
      `${t('mat.copy.crafts')}:`,
      ...list.crafts.map((c) => `- ${c.times}x ${name(c.id)} (${jobName(c.job)} ${t('common.lvlShort', { n: c.lvl })}${c.upgrade ? `, ${t('mat.upgrade')}` : ''})`),
    ];
    if (list.plans.length) lines.push('', `${t('mat.copy.plans')}:`, ...list.plans.map((p) => `- ${name(p)}`));
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
          <button className="small-btn" disabled={!list} onClick={copy}>{copied ? t('mat.copied') : t('mat.copy')}</button>
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
                      {list.plans.map((p) => <li key={p} className="plan">{name(p)}</li>)}
                    </ul>
                  </>
                )}
                <h3>{t('mat.copy.crafts')} <small>{t('mat.recipes', { n: list.crafts.length })}</small></h3>
                <ul className="mat-list">
                  {list.crafts.map((c) => (
                    <li key={c.id}>
                      <span className="qty">{fmt(c.times)}×</span> {name(c.id)}
                      <small className="muted"> {jobName(c.job)} {t('common.lvlShort', { n: c.lvl })}{c.upgrade && ` · ${t('mat.upgrade')}`}</small>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>{expand ? t('mat.raw') : t('mat.ingredients')} <small>{t('mat.distinct', { n: list.materials.length })}</small></h3>
                <ul className="mat-list">
                  {list.materials.map((m) => (
                    <li key={m.id}>
                      <img src={itemImage(gfx(m.id))} alt="" loading="lazy" referrerPolicy="no-referrer"
                        onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                      <span className="qty">{fmt(m.qty)}×</span> {name(m.id)}
                    </li>
                  ))}
                </ul>
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
