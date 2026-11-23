import { useEffect, type CSSProperties } from 'react';
import { CountUp } from '../../shell/fx';
import { rise } from '../../shell/lamp';
import { go } from '../../shell/router';
import { jobClock, movesOn, PREP, upcomingInterviews } from '../areas/jobLogic';
import { areaMinutes } from '../areas/logic';
import { AREA_STORES } from '../areas/store';
import { chapelMinutes } from '../chapel/logic';
import { useChapel } from '../chapel/store';
import { clock, type CalEvent } from '../feeds/logic';
import { useFeeds } from '../feeds/store';
import { dayTotal, nextDeadline } from '../ledger/logic';
import { useLedger } from '../ledger/store';
import { LIFE_AREAS, lifeStreak } from '../life/logic';
import { useLifeInput } from '../life/useLifeInput';
import { morningBrief } from './brief';
import { AreaMark, Lantern } from './parts';

/** The top of The Day: what today asks of each part of life, the calendar, and the whole-life streak. */
export function MorningBrief({ today }: { today: string }) {
  const { ready, input } = useLifeInput();
  const ledger = useLedger();
  const chapel = useChapel();
  const office = AREA_STORES.office();
  const forge = AREA_STORES.forge();
  const feeds = useFeeds();
  useEffect(() => { void feeds.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const moves = movesOn(office.days, today);
  const dl = nextDeadline(ledger.deadlines, today);
  const rows = morningBrief({
    writingMins: dayTotal(ledger.days[today]), writingGood: ledger.thresholds.good,
    deadline: dl ? { n: dl.n, left: dl.left } : null,
    jobMoves: moves, jobDaysLeft: jobClock(today).left,
    prayerMins: chapelMinutes(chapel.days[today]), openPrayers: chapel.prayers.filter((p) => !p.answeredOn).length,
    interview: (() => { const iv = upcomingInterviews(office.items, today)[0]; return iv ? { text: iv.text, in: iv.in, prepped: iv.prepped, of: PREP.length } : null; })(),
    walkMins: input.walks?.[today] ?? 0, workoutMins: areaMinutes(forge.days[today]), steps: feeds.days[today]?.steps,
  });
  const streak = lifeStreak(input, today);
  const events = feeds.events.filter((e) => e.day === today);
  const desk = office.items.find((i) => i.list === 'doors' && i.kind === 'desk')?.link;
  const done = rows.filter((r) => r.done).length;

  return (
    <section className="brief rise" style={rise(1)} aria-label="Today at a glance">
      <div className="brief-main">
        <div className="brief-h">
          <p className="panel-t">Today at a glance</p>
          <span className="mono faint">{done} of {rows.length} tended</span>
        </div>
        <ul className="brief-rows">
          {rows.map((r) => {
            const a = LIFE_AREAS.find((x) => x.id === r.area)!;
            return (
              <li key={r.area}>
                <button className={r.done ? 'brief-row done' : 'brief-row'} style={{ '--ac': a.color } as CSSProperties} onClick={() => go(r.path)}>
                  <Lantern lit={r.done} color={a.color} size={22} />
                  <span className="brief-txt"><b>{r.title}</b><span>{r.line}</span></span>
                  <span className="brief-go" aria-hidden>→</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="brief-acts">
          <button className="qlamp" onClick={() => go('/cabin/timer')}><span aria-hidden>◉</span> Lamp mode</button>
          {desk && <a className="btn sm" href={desk} target="_blank" rel="noopener noreferrer">Open the Recruiter Desk ↗</a>}
        </div>
        {events.length > 0 && <Events events={events} />}
      </div>

      <div className="brief-streak" aria-label={`No zero days: ${streak.current} in a row`}>
        <span className="mono brief-k">No zero days</span>
        <b className="brief-n">{ready ? <CountUp value={streak.current} /> : '—'}</b>
        <span className="mono faint">{streak.current === 1 ? 'day' : 'days'} in a row · best {streak.best}</span>
        <div className="brief-marks" aria-label={`Tended today: ${streak.today.length ? streak.today.map((t) => LIFE_AREAS.find((a) => a.id === t)!.name).join(', ') : 'nothing yet'}`}>
          {LIFE_AREAS.map((a) => <span key={a.id} className={streak.today.includes(a.id) ? 'on' : ''}><AreaMark area={a.id} size="sm" /></span>)}
        </div>
        <span className="mono faint brief-hint">{streak.today.length ? 'Today already counts.' : 'Any part of life keeps it going.'}</span>
      </div>
    </section>
  );
}

function Events({ events }: { events: CalEvent[] }) {
  return (
    <div className="brief-cal">
      <p className="mono brief-k">On the calendar</p>
      <ul>{events.map((e, i) => <li key={i}><span className="mono">{e.allDay || !e.start ? 'All day' : clock(e.start)}</span>{e.title}</li>)}</ul>
    </div>
  );
}
