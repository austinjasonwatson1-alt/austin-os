import { useMemo } from 'react';
import { addDays, mondayOf, todayISO } from '../../core/dates';
import { go } from '../../shell/router';
import { balanceScore, balanceWeek, LIFE_AREAS } from './logic';
import { useLife } from './store';
import type { LifeInput } from './logic';
import { BalanceWheel } from './Wheel';

/** The compass on Home: this week's wheel, the balance, and the area that's had the least of you. */
export function HomeCompass({ input }: { input: LifeInput }) {
  const targets = useLife((s) => s.targets);
  const today = todayISO();
  const monday = mondayOf(today);
  const now = useMemo(() => balanceWeek(input, monday, targets, today), [input, monday, targets, today]);
  const prev = useMemo(() => balanceWeek(input, addDays(monday, -7), targets), [input, monday, targets]);
  const weakest = [...now].sort((a, b) => a.score - b.score)[0];
  const w = LIFE_AREAS.find((a) => a.id === weakest.area)!;
  return (
    <button className="panel compass-card" onClick={() => go('/life')}>
      <BalanceWheel now={now} prev={prev} size={150} />
      <span>
        <span className="panel-t">The Compass · this week</span>
        <span className="cc-score"><b>{balanceScore(now)}</b> balance</span>
        <span className="dim cc-line">{weakest.score < 0.35 ? `${w.place} has had the least of you.` : 'A well-kept week so far.'} See the whole life →</span>
      </span>
    </button>
  );
}
