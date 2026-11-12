import { useMemo, useState } from 'react';
import { CLASSES, ROLES, type Role } from './lib/game';
import { getLang, t, tk } from './lib/i18n';
import { spellImage, type Spell, type SpellData } from './lib/spells';
import { DUNGEONS } from './lib/dungeons';
import { needsOf, type DungeonNeeds, type Requirement } from './lib/dungeons/requirements';
import {
  NEEDS, bestRole, contributionNote, contributions, coverage, mainNeed, needStatus, replacements,
  type Member, type Need,
} from './lib/teams';
import {
  MISSING_DAMAGE, dungeonDiff, recommendBaseTeam, suggestFix, teamReport,
  type DungeonResult, type Fix, type TeamReport,
} from './lib/teamDungeons';

const classLabel = (id: string) => CLASSES.find((c) => c.id === id)!.label;
const roleLabel = (r: Role) => ROLES.find((x) => x.id === r)!.label;
const needLabel = (n: Need) => tk(`team.need.${n}`);
const joinNames = (members: Member[]) => members.map((m) => classLabel(m.classId)).join(', ');
const dungeonName = (id: string) => DUNGEONS.find((d) => d.id === id)!.name[getLang()];
const joinDungeons = (ids: string[]) => ids.map(dungeonName).join(', ');

/** Nombre visible de una exigencia: necesidad, subtipos de colocación ("empujar o atraer") y número de personajes. */
export function reqLabel(r: Requirement): string {
  let s = needLabel(r.need);
  if (r.place !== undefined) {
    const kinds = (Array.isArray(r.place) ? r.place : [r.place]).map((k) => tk(`team.place.${k}`).toLowerCase());
    const list = kinds.length > 1 ? `${kinds.slice(0, -1).join(', ')} ${t('team.or')} ${kinds[kinds.length - 1]}` : kinds[0];
    s += ` (${list})`;
  }
  if ((r.count ?? 1) > 1) s += ` ×${r.count}`;
  return s;
}

/** Aplica un cambio de clase: la anterior deja de estar fijada y la nueva queda fijada. No modifica la entrada. */
export function applySwap(state: { team: Member[]; pins: string[] }, index: number, m: Member): { team: Member[]; pins: string[] } {
  const old = state.team[index].classId;
  return {
    team: state.team.map((x, i) => (i === index ? m : x)),
    pins: [...state.pins.filter((id) => id !== old), m.classId],
  };
}

/** Franjas que empiezan abiertas: las que tienen alguna mazmorra sin cubrir. */
export const initiallyOpen = (report: TeamReport): boolean[] => report.tiers.map((g) => g.covered < g.total);

// Último cambio por gusto: qué mazmorras se ganan o pierden, propuesta de equipo y vuelta atrás.
interface Change {
  prevTeam: Member[];
  prevPins: string[];
  gained: string[];
  lost: string[];
  proposal: Member[] | null;
  checked: boolean;
}

function Coverage({ team, label }: { team: Member[]; label: string }) {
  const cov = coverage(team);
  return (
    <ul className="team-cov" aria-label={label}>
      {NEEDS.map((n) => {
        const status = needStatus(cov[n]);
        return (
          <li key={n} className={status}>
            {needLabel(n)}<span className="sr-only"> ({tk(`team.status.${status}`)})</span>
            <span aria-hidden="true"> {status === 'ok' ? '✓' : status === 'weak' ? '~' : '✕'}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Uncovered({ result, team, fix, total, onFix, onOpen }: {
  result: DungeonResult; team: Member[]; fix: Fix | null; total: number;
  onFix: (f: Fix) => void; onOpen: (id: string) => void;
}) {
  const name = dungeonName(result.id);
  return (
    <li className="team-dg">
      <button type="button" className="team-dg-name" onClick={() => onOpen(result.id)} aria-label={t('team.openDungeon', { name })}>
        <span aria-hidden="true">⚠ </span>{name}
      </button>
      <ul className="team-miss">
        {result.missing.map((r, i) => (
          <li key={i}>
            <b>{r === MISSING_DAMAGE ? t('team.need.melee') + ' / ' + t('team.need.ranged') : reqLabel(r)}</b>
            <span className="muted"> · {r.why[getLang()]}</span>
          </li>
        ))}
      </ul>
      {result.group.length < team.length && (
        <p className="muted small">{t('team.subgroup', { n: result.group.length, names: joinNames(result.group) })}</p>
      )}
      {fix
        ? (
          <div className="row wrap">
            <button type="button" className="btn" onClick={() => onFix(fix)}>
              {t('team.fix', { out: classLabel(team[fix.index].classId), in: classLabel(fix.member.classId), total: fix.total, n: total })}
            </button>
          </div>
        )
        : <p className="muted small">{t('team.noFix')}</p>}
    </li>
  );
}

export default function TeamsPanel({ spellData, initialClass, onBuild, onOpenDungeon, needs = needsOf }: {
  spellData: SpellData | null; initialClass: string; onBuild: (classId: string, role: Role) => void;
  onOpenDungeon: (id: string) => void;
  /** Exigencias por mazmorra; se inyecta en las pruebas. */
  needs?: (id: string) => DungeonNeeds;
}) {
  const [classId, setClassId] = useState(initialClass);
  const [role, setRole] = useState<Role>(() => CLASSES.find((c) => c.id === initialClass)!.roles[0]);
  const [team, setTeam] = useState<Member[]>(() => recommendBaseTeam([{ classId: initialClass, role }], needs));
  const [pins, setPins] = useState<string[]>([]);   // clases elegidas a mano: se conservan en las propuestas
  const [selected, setSelected] = useState(0);
  const [change, setChange] = useState<Change | null>(null);

  const cls = CLASSES.find((c) => c.id === classId)!;
  const report = useMemo(() => teamReport(team, needs), [team, needs]);
  const fixes = useMemo(() => {
    const out = new Map<string, Fix | null>();
    for (const g of report.tiers) for (const r of g.results) if (!r.covered) out.set(r.id, suggestFix(team, r.id, needs));
    return out;
  }, [report, team, needs]);
  // Las franjas se abren según el equipo de partida; luego el usuario las pliega a su gusto.
  const [open] = useState(() => initiallyOpen(report));

  const regenerate = (id: string, r: Role) => {
    setTeam(recommendBaseTeam([{ classId: id, role: r }], needs));
    setPins([]);
    setSelected(0);
    setChange(null);
  };

  const pickClass = (id: string) => {
    const r = CLASSES.find((c) => c.id === id)!.roles[0];
    setClassId(id);
    setRole(r);
    regenerate(id, r);
  };
  const pickRole = (r: Role) => { setRole(r); regenerate(classId, r); };

  const swap = (index: number, m: Member) => {
    const next = applySwap({ team, pins }, index, m);
    const { gained, lost } = dungeonDiff(team, next.team, needs);
    setChange({ prevTeam: team, prevPins: pins, gained, lost, proposal: null, checked: false });
    setTeam(next.team);
    setPins(next.pins);
  };

  const propose = () => {
    if (!change) return;
    const fixed = team.filter((m, i) => i === 0 || pins.includes(m.classId));
    const proposal = recommendBaseTeam(fixed, needs);
    const same = proposal.every((m) => team.some((x) => x.classId === m.classId));
    setChange({ ...change, checked: true, proposal: same ? null : proposal });
  };

  const accept = () => {
    if (!change?.proposal) return;
    setTeam(change.proposal);
    setSelected(0);
    setChange(null);
  };

  const undo = () => {
    if (!change) return;
    setTeam(change.prevTeam);
    setPins(change.prevPins);
    setChange(null);
  };

  const member = team[selected];
  const why = mainNeed(team, selected);
  const spellOf = (id: number): Spell | undefined => spellData?.classes[member.classId]?.find((s) => s.id === id);
  const alternatives = selected === 0 ? [] : replacements(team, selected);
  const others = CLASSES.filter((c) => !team.some((m) => m.classId === c.id) && !alternatives.some((a) => a.classId === c.id));
  const leaving = change?.proposal ? team.filter((m) => !change.proposal!.some((x) => x.classId === m.classId)) : [];
  const entering = change?.proposal ? change.proposal.filter((m) => !team.some((x) => x.classId === m.classId)) : [];
  const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 100);

  return (
    <div className="teams">
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>{t('team.title')}</h2>
            <p className="muted">{t('team.intro')}</p>
          </div>
        </div>
        <div className="team-controls">
          <div className="field">
            <label htmlFor="team-class" className="label">{t('team.class')}</label>
            <select id="team-class" value={classId} onChange={(e) => pickClass(e.target.value)}>
              {CLASSES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          {cls.roles.length > 1 && (
            <div className="field">
              <span className="label" id="team-role">{t('team.role')}</span>
              <div className="seg" role="group" aria-labelledby="team-role">
                {cls.roles.map((r) => (
                  <button key={r} type="button" className={role === r ? 'on' : ''} aria-pressed={role === r} onClick={() => pickRole(r)}>
                    {roleLabel(r)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {change && (
        <div className={`panel team-notice ${change.lost.length ? 'warn' : ''}`} role="status">
          {change.gained.length === 0 && change.lost.length === 0
            ? <p>{t('team.noDiff')}</p>
            : (
              <>
                {change.gained.length > 0 && <p>{t('team.gained', { names: joinDungeons(change.gained) })}</p>}
                {change.lost.length > 0 && <p>{t('team.lostDungeons', { names: joinDungeons(change.lost) })}</p>}
              </>
            )}
          {change.proposal && (
            <div className="team-proposal">
              <h3>{t('team.proposalTitle')}</h3>
              <p>{t('team.proposalLeaves', { names: joinNames(leaving) })}</p>
              <p>{t('team.proposalJoins', { names: joinNames(entering) })}</p>
              <div className="row wrap">
                <button type="button" className="btn primary" onClick={accept}>{t('team.accept')}</button>
                <button type="button" className="btn ghost" onClick={() => setChange({ ...change, proposal: null, checked: false })}>{t('team.discard')}</button>
              </div>
            </div>
          )}
          {change.checked && !change.proposal && <p className="muted">{t('team.noBetter')}</p>}
          <div className="row wrap">
            {!change.proposal && !change.checked && (
              <button type="button" className={`btn ${change.lost.length ? 'primary' : ''}`} onClick={propose}>{t('team.seeProposal')}</button>
            )}
            <button type="button" className="btn ghost" onClick={undo}>{t('team.undo')}</button>
          </div>
        </div>
      )}

      <div className="team-grid">
        <div className="panel">
          <ul className="team-list" aria-label={t('team.listAria')}>
            {team.map((m, i) => (
              <li key={m.classId}>
                <button type="button" className={selected === i ? 'on' : ''} aria-pressed={selected === i} onClick={() => setSelected(i)}>
                  <b>{classLabel(m.classId)}{i === 0 ? ` · ${t('team.you')}` : ''}</b>
                  <span className="team-row-meta"><span>{roleLabel(m.role)}</span></span>
                </button>
              </li>
            ))}
          </ul>
          <h3 className="team-cov-title">{t('team.covers')}</h3>
          <Coverage team={team} label={t('team.covers')} />
        </div>

        <div className="panel team-detail">
          <h2>{classLabel(member.classId)}</h2>
          <span className="eyebrow">{t('team.whyTitle')}</span>
          <p>
            {selected === 0
              ? t('team.whyMine')
              : t(why.only ? 'team.whyOnly' : 'team.why', { need: needLabel(why.need) })}
          </p>

          <span className="eyebrow">{t('team.provides')}</span>
          <ul className="team-gives">
            {(member.role === 'melee' || member.role === 'dist') && (
              <li><div><b>{needLabel(member.role === 'melee' ? 'melee' : 'ranged')}</b><p className="muted">{tk(`team.base.${member.role}`)}</p></div></li>
            )}
            {contributions(member).map((x) => {
              const spell = spellOf(x.spell);
              return (
                <li key={`${x.need}-${x.spell}-${x.place ?? ''}`}>
                  {spell && <img src={spellImage(spell.icon)} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                  <div>
                    <b>{needLabel(x.need)}{x.place ? ` (${tk(`team.place.${x.place}`).toLowerCase()})` : ''}</b>
                    {spell && <span className="muted"> · {spell.name}{spell.lvl ? ` (${t('common.lvlShort', { n: spell.lvl })})` : ''}</span>}
                    <p className="muted">{contributionNote(x)}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          {selected > 0 && (
            <>
              <span className="eyebrow">{t('team.alternatives')}</span>
              {alternatives.length > 0
                ? (
                  <div className="row wrap">
                    {alternatives.map((m) => (
                      <button key={m.classId} type="button" className="chip" onClick={() => swap(selected, m)}>{classLabel(m.classId)}</button>
                    ))}
                  </div>
                )
                : <p className="muted">{t('team.noAlternatives')}</p>}
              {others.length > 0 && (
                <div className="field">
                  <label htmlFor="team-other" className="label">{t('team.otherClass')}</label>
                  <select id="team-other" value="" onChange={(e) => {
                    if (e.target.value) swap(selected, { classId: e.target.value, role: bestRole(e.target.value, team, selected) });
                  }}>
                    <option value="">{t('team.otherPlaceholder')}</option>
                    {others.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              )}
            </>
          )}
          <div className="row wrap">
            <button type="button" className="btn" onClick={() => onBuild(member.classId, member.role)}>{t('team.makeBuild')}</button>
          </div>
        </div>
      </div>

      <div className="panel team-report">
        <h2>{t('team.coverTotal', { n: report.covered, total: report.total })}</h2>
        <ul className="team-bars" aria-label={t('team.coverTiers')}>
          {report.tiers.map((g) => (
            <li key={g.tier[0]}>
              <span className="team-bar-label">{g.tier[0]}–{g.tier[1]}</span>
              <span className="team-bar" aria-hidden="true"><span style={{ width: `${pct(g.covered, g.total)}%` }} /></span>
              <span className="team-bar-n">{g.covered}/{g.total}</span>
            </li>
          ))}
        </ul>

        <h3>{t('team.dungeonsTitle')}</h3>
        {report.tiers.map((g, gi) => {
          const uncovered = g.results.filter((r) => !r.covered);
          const covered = g.results.filter((r) => r.covered);
          return (
            <details key={g.tier[0]} className="team-tier" open={open[gi]}>
              <summary>{`${g.tier[0]}–${g.tier[1]} · ${g.covered}/${g.total}`}</summary>
              {uncovered.length > 0 && (
                <ul className="team-dgs">
                  {uncovered.map((r) => (
                    <Uncovered key={r.id} result={r} team={team} fix={fixes.get(r.id) ?? null} total={report.total}
                      onFix={(f) => swap(f.index, f.member)} onOpen={onOpenDungeon} />
                  ))}
                </ul>
              )}
              {covered.length > 0 && (
                <p className="team-ok">
                  <span className="muted">{t('team.coveredList')}: </span>
                  {covered.map((r, i) => (
                    <span key={r.id}>
                      {i > 0 && ', '}
                      <button type="button" className="team-dg-link" onClick={() => onOpenDungeon(r.id)}
                        aria-label={t('team.openDungeon', { name: dungeonName(r.id) })}>
                        <span aria-hidden="true">✓ </span>{dungeonName(r.id)}
                      </button>
                    </span>
                  ))}
                </p>
              )}
            </details>
          );
        })}
        <p className="muted small">{t('team.guidesNote')}</p>
      </div>

      <p className="muted small">{t('team.disclaimer')}</p>
    </div>
  );
}
