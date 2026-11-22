/** The Kennel: walks, vet & care, weights and little moments for Cooper and Shadow. */

export type DogId = 'cooper' | 'shadow';
/** Who a record is about. A walk or a vet trip can be both dogs at once. */
export type Who = DogId | 'both';

export interface Walk {
  id: string;
  /** Local 'YYYY-MM-DD'. */
  date: string;
  who: Who;
  minutes: number;
  note?: string;
}

export type CareKind = 'vet' | 'vaccine' | 'flea' | 'heartworm' | 'grooming' | 'other';

export interface Care {
  id: string;
  date: string;
  who: Who;
  kind: CareKind;
  /** e.g. "Rabies", "Annual checkup". */
  title?: string;
  note?: string;
  /** When this needs doing again, 'YYYY-MM-DD'. */
  nextDue?: string;
}

export interface Weight {
  id: string;
  date: string;
  dog: DogId;
  lb: number;
}

export interface Note {
  id: string;
  date: string;
  who: Who;
  text: string;
}

export interface KennelData {
  walks: Walk[];
  care: Care[];
  weights: Weight[];
  notes: Note[];
}

export const DEFAULT_KENNEL: KennelData = { walks: [], care: [], weights: [], notes: [] };

export const DOGS: { id: DogId; name: string; line: string; collar: string }[] = [
  { id: 'cooper', name: 'Cooper', line: 'Black lab with big hound ears. Leads every walk, steals every pancake.', collar: '#d1503f' },
  { id: 'shadow', name: 'Shadow', line: 'Smaller lab–terrier mix, scruffy and quick. Never more than a step behind.', collar: '#6fb3f2' },
];

export const CARE_KINDS: { k: CareKind; label: string; glyph: string }[] = [
  { k: 'vet', label: 'Vet visit', glyph: '✚' },
  { k: 'vaccine', label: 'Vaccine', glyph: '◆' },
  { k: 'flea', label: 'Flea / tick', glyph: '❋' },
  { k: 'heartworm', label: 'Heartworm', glyph: '♥' },
  { k: 'grooming', label: 'Grooming', glyph: '✂' },
  { k: 'other', label: 'Other', glyph: '✦' },
];

export const WHO_LABEL: Record<Who, string> = { both: 'Both', cooper: 'Cooper', shadow: 'Shadow' };
