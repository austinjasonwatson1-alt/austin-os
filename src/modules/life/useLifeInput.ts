import { useEffect, useMemo } from 'react';
import { AREA_STORES } from '../areas/store';
import { useChapel } from '../chapel/store';
import { useLedger } from '../ledger/store';
import type { LifeInput } from './logic';
import { useLife } from './store';
import { useKennel } from '../kennel/store';
import { kennelWalkMinutes } from '../kennel/logic';

/** Everything the Compass reads, loaded and gathered in one place. */
export function useLifeInput(): { ready: boolean; input: LifeInput } {
  const ledger = useLedger(); const chapel = useChapel(); const life = useLife();
  const office = AREA_STORES.office(); const obs = AREA_STORES.observatory(); const forge = AREA_STORES.forge(); const hearth = AREA_STORES.hearth();
  useEffect(() => {
    void ledger.load(); void chapel.load(); void life.load();
    for (const s of [AREA_STORES.office, AREA_STORES.observatory, AREA_STORES.forge, AREA_STORES.hearth]) void s.getState().load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const walks = useWalks();
  const input = useMemo<LifeInput>(() => ({ ledger: ledger.days, chapel: chapel.days, office: office.days, observatory: obs.days, forge: forge.days, hearth: hearth.days, walks }),
    [ledger.days, chapel.days, office.days, obs.days, forge.days, hearth.days, walks]);
  return { ready: ledger.loaded && chapel.loaded && life.loaded && office.loaded && obs.loaded && forge.loaded && hearth.loaded, input };
}

/** Dog walks per day (the Kennel), counted with the body. */
function useWalks(): Record<string, number> {
  const k = useKennel();
  useEffect(() => { void k.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return useMemo(() => {
    const out: Record<string, number> = {};
    for (const w of k.walks) out[w.date] = kennelWalkMinutes(k, w.date);
    return out;
  }, [k.walks]); // eslint-disable-line react-hooks/exhaustive-deps
}
