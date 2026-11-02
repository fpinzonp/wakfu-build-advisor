import { useMemo, useState } from 'react';
import { BUILD_SLOTS, RARITIES, itemImage, type Item, type RecipeData } from './lib/game';
import { materialsFor } from './lib/materials';
import type { BuildSlots } from './lib/optimizer';

const fmt = (n: number) => n.toLocaleString('es-ES');

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
      'Materiales:',
      ...list.materials.map((m) => `- ${m.qty}x ${name(m.id)}`),
      '',
      'Crafteos:',
      ...list.crafts.map((c) => `- ${c.times}x ${name(c.id)} (${c.job} nv. ${c.lvl}${c.upgrade ? ', mejora' : ''})`),
    ];
    if (list.plans.length) lines.push('', 'Planos:', ...list.plans.map((p) => `- ${name(p)}`));
    if (others.length) lines.push('', 'No crafteables (drop / otros):', ...others.map((i) => `- ${i.name}`));
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="panel materials">
      <div className="mat-head">
        <h2>Materiales para craftear el set</h2>
        <div className="row">
          <label className="check">
            <input type="checkbox" checked={expand} onChange={(e) => setExpand(e.target.checked)} />
            <span>Desglosar intermedios hasta materias primas</span>
          </label>
          <label className="check" title="Si está desactivado, el objeto base de cada mejora (p. ej. el mítico) aparece como material a conseguir">
            <input type="checkbox" checked={fullChain} onChange={(e) => setFullChain(e.target.checked)} />
            <span>Cadena de mejoras completa</span>
          </label>
          <button className="small-btn" disabled={!list} onClick={copy}>{copied ? 'Copiado ✓' : 'Copiar lista'}</button>
        </div>
      </div>

      {craftable.length === 0 ? (
        <p className="muted">Ninguna pieza de esta build se puede craftear.</p>
      ) : (
        <>
          <h3>Piezas a craftear <small>marca las que ya tienes</small></h3>
          <div className="row wrap">
            {craftable.map((i) => (
              <label key={i.id} className={`chip piece ${owned.has(i.id) ? '' : 'on'}`} style={{ color: RARITIES[i.rarity].color }}>
                <input type="checkbox" checked={!owned.has(i.id)} onChange={() => toggleOwned(i.id)} />
                {i.name}
              </label>
            ))}
          </div>

          {!list ? <p className="muted">Cargando recetas…</p> : toCraft.length === 0 ? (
            <p className="muted">Ya tienes todas las piezas crafteables.</p>
          ) : (
            <div className="mat-grid">
              <div>
                <h3>Profesiones necesarias</h3>
                <div className="row wrap">
                  {list.jobs.map((j) => <span key={j.job} className="chip">{j.job} · nv. {j.lvl}</span>)}
                </div>
                {list.plans.length > 0 && (
                  <>
                    <h3>Planos necesarios</h3>
                    <ul className="mat-list">
                      {list.plans.map((p) => <li key={p} className="plan">{name(p)}</li>)}
                    </ul>
                  </>
                )}
                <h3>Crafteos <small>{list.crafts.length} recetas</small></h3>
                <ul className="mat-list">
                  {list.crafts.map((c) => (
                    <li key={c.id}>
                      <span className="qty">{fmt(c.times)}×</span> {name(c.id)}
                      <small className="muted"> {c.job} nv. {c.lvl}{c.upgrade && ' · mejora'}</small>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>{expand ? 'Materias primas' : 'Ingredientes'} <small>{list.materials.length} distintos</small></h3>
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
          <h3>No crafteables <small>conseguir por drop u otras vías</small></h3>
          <div className="row wrap">
            {others.map((i) => <span key={i.id} className="chip" style={{ color: RARITIES[i.rarity].color }}>{i.name}</span>)}
          </div>
        </>
      )}
    </div>
  );
}
