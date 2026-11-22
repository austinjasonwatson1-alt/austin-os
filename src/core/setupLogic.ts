/** What's switched on, and what's left to set up: the checklist at the top of Settings. Pure. */

export interface SetupState {
  backupFile: boolean; cloud: boolean; keeper: boolean; weather: boolean; sound: boolean; reminders: boolean;
  /** When each Shortcut last delivered something (ISO), if ever. */
  healthAt: string | null; calendarAt: string | null; ideaLinkAt: string | null;
  installed: boolean;
  now: number;
}
export interface SetupStep { id: string; label: string; why: string; done: boolean; target: string; essential: boolean }

const fresh = (iso: string | null, days: number, now: number) => Boolean(iso && now - Date.parse(iso) < days * 86_400_000);

export function setupSteps(s: SetupState): SetupStep[] {
  return [
    { id: 'backup', label: 'Automatic backup', why: 'Every change copied to a file you own (iCloud Drive is ideal). The one that protects everything else.', done: s.backupFile, target: 'set-safety', essential: true },
    { id: 'cloud', label: 'Cloud sync with your phone', why: 'The same homestead on your phone and computer, end-to-end encrypted.', done: s.cloud, target: 'set-cloud', essential: true },
    { id: 'install', label: 'Austin OS on your home screen', why: 'In Safari: Share → Add to Home Screen. It opens like an app and works offline.', done: s.installed, target: '', essential: true },
    { id: 'keeper', label: 'Wake the Keeper', why: 'Your Anthropic API key, kept on this device. Morning notes, weekly letters, help with ideas and queries.', done: s.keeper, target: 'set-keeper', essential: false },
    { id: 'health', label: 'Apple Health, every night', why: 'Steps, sleep and workouts into the Forge, by a Shortcut that runs itself.', done: fresh(s.healthAt, 3, s.now), target: 'set-feeds', essential: false },
    { id: 'calendar', label: 'Today’s calendar on Home', why: 'Your events and free writing windows, by a morning Shortcut or an .ics file.', done: fresh(s.calendarAt, 3, s.now), target: 'set-feeds', essential: false },
    { id: 'idea', label: '“Hey Siri, new idea”', why: 'A spoken idea straight into the Idea Vault.', done: Boolean(s.ideaLinkAt), target: 'set-siri', essential: false },
    { id: 'weather', label: 'Real weather', why: 'Real rain in the sky and the soundscape when it’s raining where you are.', done: s.weather, target: 'set-sky', essential: false },
    { id: 'sound', label: 'The soundscape', why: 'Rain, the fire, birdsong, calm keys for writing.', done: s.sound, target: 'set-sky', essential: false },
    { id: 'reminders', label: 'Gentle reminders', why: 'The streak, the candle, Sunday’s review, query follow-ups.', done: s.reminders, target: 'set-reminders', essential: false },
  ];
}

export const setupProgress = (steps: SetupStep[]) => ({ done: steps.filter((x) => x.done).length, total: steps.length, essentialsLeft: steps.filter((x) => x.essential && !x.done).length });
