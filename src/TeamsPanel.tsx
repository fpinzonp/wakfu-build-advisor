import { useMemo, useState } from 'react';
import { CLASSES, ROLES, type Role } from './lib/game';
import { t, tk } from './lib/i18n';
import { spellImage, type Spell, type SpellData } from './lib/spells';
import {
  NEEDS, SIX_CONTENTS, bestRole, bestTrio, contributionNote, contributions, coverage, lostNeeds, mainNeed,
  needStatus, recommendTeam, replacements,
  type Content, type Member, type Need, type TeamSize,
} from './lib/teams';

const classLabel = (id: string) => CLASSES.find((c) => c.id === id)!.label;
const roleLabel = (r: Role) => ROLES.find((x) => x.id === r)!.label;
const needLabel = (n: Need) => tk(`team.need.${n}`);
const joinNames = (members: Member[]) => members.map((m) => classLabel(m.classId)).join(', ');

// Último cambio por gusto: permite ver lo perdido, pedir otra propuesta o volver atrás.
interface Change {
  prevTeam: Member[];
  prevPins: string[];
  lost: Need[];
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

export default function TeamsPanel({ spellData, initialClass, onBuild }: {
  spellData: SpellData | null; initialClass: string; onBuild: (classId: string, role: Role) => void;
}) {
  const [classId, setClassId] = useState(initialClass);
  const [role, setRole] = useState<Role>(() => CLASSES.find((c) => c.id === initialClass)!.roles[0]);
  const [size, setSize] = useState<TeamSize>(6);
  const [sixContent, setSixContent] = useState<Content>('rooms');
  const [team, setTeam] = useState<Member[]>(() => recommendTeam([{ classId: initialClass, role }], 'rooms'));
  const [pins, setPins] = useState<string[]>([]);   // clases elegidas a mano: se conservan en las propuestas
  const [selected, setSelected] = useState(0);
  const [change, setChange] = useState<Change | null>(null);

  const content: Content = size === 3 ? 'trio' : sixContent;
  const cls = CLASSES.find((c) => c.id === classId)!;
  const trio = useMemo(() => (size === 6 ? bestTrio(team) : null), [team, size]);

  const regenerate = (id: string, r: Role, c: Content) => {
    setTeam(recommendTeam([{ classId: id, role: r }], c));
    setPins([]);
    setSelected(0);
    setChange(null);
  };

  const pickClass = (id: string) => {
    const r = CLASSES.find((c) => c.id === id)!.roles[0];
    setClassId(id);
    setRole(r);
    regenerate(id, r, content);
  };
  const pickRole = (r: Role) => { setRole(r); regenerate(classId, r, content); };
  const pickSize = (s: TeamSize) => { setSize(s); regenerate(classId, role, s === 3 ? 'trio' : sixContent); };
  const pickContent = (c: Content) => { setSixContent(c); regenerate(classId, role, c); };

  const swap = (index: number, m: Member) => {
    const next = team.map((x, i) => (i === index ? m : x));
    setChange({ prevTeam: team, prevPins: pins, lost: lostNeeds(team, next), proposal: null, checked: false });
    setTeam(next);
    setPins([...pins.filter((id) => id !== team[index].classId), m.classId]);
  };

  const propose = () => {
    if (!change) return;
    const fixed = team.filter((m, i) => i === 0 || pins.includes(m.classId));
    const proposal = recommendTeam(fixed, content);
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
  const why = mainNeed(team, selected, content);
  const spellOf = (id: number): Spell | undefined => spellData?.classes[member.classId]?.find((s) => s.id === id);
  const alternatives = selected === 0 ? [] : replacements(team, selected, content);
  const others = CLASSES.filter((c) => !team.some((m) => m.classId === c.id) && !alternatives.some((a) => a.classId === c.id));
  const leaving = change?.proposal ? team.filter((m) => !change.proposal!.some((x) => x.classId === m.classId)) : [];
  const entering = change?.proposal ? change.proposal.filter((m) => !team.some((x) => x.classId === m.classId)) : [];

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
          <div className="field">
            <span className="label" id="team-size">{t('team.size')}</span>
            <div className="seg" role="group" aria-labelledby="team-size">
              {([6, 3] as TeamSize[]).map((s) => (
                <button key={s} type="button" className={size === s ? 'on' : ''} aria-pressed={size === s} onClick={() => pickSize(s)}>
                  {tk(`team.size.${s}`)}
                </button>
              ))}
            </div>
          </div>
          {size === 6 && (
            <div className="field">
              <span className="label" id="team-content">{t('team.content')}</span>
              <div className="seg" role="group" aria-labelledby="team-content">
                {SIX_CONTENTS.map((c) => (
                  <button key={c} type="button" className={sixContent === c ? 'on' : ''} aria-pressed={sixContent === c} onClick={() => pickContent(c)}>
                    {tk(`team.content.${c}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <p className="muted small">{tk(`team.content.${content}.hint`)}</p>
      </div>

      {change && (
        <div className={`panel team-notice ${change.lost.length ? 'warn' : ''}`} role="status">
          <p>
            {change.lost.length
              ? t('team.lost', { needs: change.lost.map(needLabel).join(', ') })
              : t('team.noLoss')}
          </p>
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
            {change.lost.length > 0 && !change.proposal && !change.checked && (
              <button type="button" className="btn primary" onClick={propose}>{t('team.seeProposal')}</button>
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
                  <span className="team-row-meta">
                    {trio?.some((x) => x.classId === m.classId) && <span className="team-badge">{t('team.trioBadge')}</span>}
                    <span>{roleLabel(m.role)}</span>
                  </span>
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
                <li key={`${x.need}-${x.spell}`}>
                  {spell && <img src={spellImage(spell.icon)} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                  <div>
                    <b>{needLabel(x.need)}</b>
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
                    if (e.target.value) swap(selected, { classId: e.target.value, role: bestRole(e.target.value, team, selected, content) });
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

      {trio && (
        <div className="panel">
          <h3>{t('team.trioTitle')}</h3>
          <p>{t('team.trioText', { names: joinNames(trio) })}</p>
          <Coverage team={trio} label={t('team.trioTitle')} />
        </div>
      )}

      <p className="muted small">{t('team.disclaimer')}</p>
    </div>
  );
}
