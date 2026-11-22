import { useEffect, useRef, type CSSProperties } from 'react';
import { embers } from '../../shell/fx';
import { go } from '../../shell/router';
import { AREA, closeable, dayScore, entryOf, habitsFor, nextState, phase } from './logic';
import { AreaMark, Lantern, STATE_GLYPH, areaColor, stateTitle, useNow } from './parts';
import { useDay } from './store';
import type { Habit, IntentionState, LifeArea } from './types';

/** Home card for today: set the day in the morning, mark it through the day, close it at night. */
export function TodayCard({ onOpen = () => go('/day') }: { onOpen?: () => void }) {
  const s = useDay();
  useEffect(() => { void s.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { now, today } = useNow();
  const ph = phase(now);
  const e = entryOf(s.days, today);
  const habits = habitsFor(s.habits, e, today);
  const done = habits.filter((h) => e.done.includes(h.id)).length;
  const score = dayScore(e);
  const hasInts = e.intentions.length > 0;
  const sealed = Boolean(e.closedAt);

  const head = sealed ? 'The day is sealed' : ph === 'morning' ? (hasInts ? 'The day is set' : 'A new day') : ph === 'evening' ? 'Evening' : 'Today';
  let prompt: { label: string; line: string } | null = null;
  if (!sealed && ph === 'morning' && !hasInts) prompt = { label: 'Set the day', line: 'One intention per part of life, if it wants one.' };
  else if (!sealed && ph === 'evening') prompt = { label: 'Close the day', line: closeable(e) ? 'Everything’s marked. Two lines, then seal it.' : 'Mark what was kept, write two lines, seal it.' };
  else if (!sealed && !hasInts && !habits.length) prompt = { label: 'Set the day', line: 'Nothing set yet for today.' };

  return (
    <section className={`panel today-card ph-${ph}${sealed ? ' sealed' : ''}`} aria-label="Today">
      <div className="tc-head">
        <div>
          <p className="panel-t">{head}</p>
          <div className="tc-sub mono faint">
            {habits.length > 0 && <span>{done}/{habits.length} lanterns</span>}
            {score !== null && <span>{Math.round(score * 100)}% kept</span>}
          </div>
        </div>
        <button className="tc-open" onClick={onOpen} aria-label="Open the Day">
          <Lantern lit={done > 0 || (score ?? 0) > 0 || sealed} size={22} />
        </button>
      </div>

      {prompt && (
        <button className="tc-prompt" onClick={onOpen}>
          <span className="tc-prompt-l">{prompt.label} <span aria-hidden>→</span></span>
          <span className="tc-prompt-s">{prompt.line}</span>
        </button>
      )}

      {hasInts && (
        <ul className="tc-ints">
          {e.intentions.map((i) => <TcIntention key={i.area} day={today} area={i.area} text={i.text} state={i.state} locked={sealed} />)}
        </ul>
      )}

      {habits.length > 0 && (
        <div className="tc-habs">
          {habits.map((h) => <TcHabit key={h.id} h={h} day={today} done={e.done.includes(h.id)} />)}
        </div>
      )}

      {sealed && (e.well || e.carry) && <p className="tc-well">“{e.well || e.carry}”</p>}
      {!prompt && !hasInts && !habits.length && sealed && <p className="tc-well faint">Sealed. Rest well.</p>}
    </section>
  );
}

function TcIntention({ day, area, text, state, locked }: { day: string; area: LifeArea; text: string; state?: IntentionState; locked: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <li className={`tc-int st-${state ?? 'open'}`} style={{ '--ac': AREA[area].color } as CSSProperties}>
      <button ref={ref} disabled={locked} onClick={() => { const n = nextState(state); if (n === 'kept') embers(ref.current, 6); useDay.getState().mark(day, area, n); }}
        title={stateTitle(state)} aria-label={`${text}: ${stateTitle(state)}. Tap to change.`}>
        <AreaMark area={area} size="sm" />
        <span className="tc-int-t">{text}</span>
        <span className="tc-int-m" aria-hidden>{state ? STATE_GLYPH[state] : '◌'}</span>
      </button>
    </li>
  );
}

function TcHabit({ h, day, done }: { h: Habit; day: string; done: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button ref={ref} className={done ? 'hchip on' : 'hchip'} style={{ '--ac': areaColor(h.area) } as CSSProperties} aria-pressed={done}
      onClick={() => { if (useDay.getState().toggleHabit(day, h.id)) embers(ref.current, 8); }}>
      <Lantern lit={done} size={12} color={h.area ? AREA[h.area].color : undefined} />{h.name}
    </button>
  );
}
