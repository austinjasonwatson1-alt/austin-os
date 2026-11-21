/** The business of writing: queries, contests, feedback and outreach, plus the road to the debut. */

export type QueryStatus = 'researching' | 'queried' | 'partial' | 'full' | 'pass' | 'offer' | 'closed';
export interface Query {
  id: string;
  agent: string;
  agency?: string;
  contact?: string;
  status: QueryStatus;
  sentOn?: string;
  respondedOn?: string;
  /** What was sent, e.g. "query + 10 pages". */
  materials?: string;
  ms?: string;
  notes?: string;
}

export type ContestStatus = 'considering' | 'entered' | 'longlist' | 'shortlist' | 'won' | 'not-placed';
export interface Contest {
  id: string;
  name: string;
  deadline: string;
  fee?: number;
  wordLimit?: number;
  prize?: string;
  url?: string;
  status: ContestStatus;
  piece?: string;
  notes?: string;
}

export type FeedbackKind = 'beta' | 'editor' | 'critique' | 'agent';
export interface Feedback {
  id: string;
  from: string;
  kind: FeedbackKind;
  date: string;
  ms?: string;
  chapter?: string;
  text: string;
  resolved?: boolean;
}

export type OutreachKind = 'reviewer' | 'bookstore' | 'podcast' | 'author' | 'press' | 'friend';
export type OutreachStatus = 'idea' | 'contacted' | 'yes' | 'no' | 'done';
export interface Outreach {
  id: string;
  name: string;
  kind: OutreachKind;
  status: OutreachStatus;
  contact?: string;
  notes?: string;
  date?: string;
}

export interface PubData {
  queries: Query[];
  contests: Contest[];
  feedback: Feedback[];
  outreach: Outreach[];
  /** Milestones only Austin can mark: the deal and the book in the world. */
  road: { signed?: string; published?: string };
}

export const DEFAULT_PUB: PubData = { queries: [], contests: [], feedback: [], outreach: [], road: {} };

export const QUERY_LABEL: Record<QueryStatus, string> = { researching: 'Researching', queried: 'Queried', partial: 'Partial request', full: 'Full request', pass: 'Pass', offer: 'Offer!', closed: 'Closed (no reply)' };
export const CONTEST_LABEL: Record<ContestStatus, string> = { considering: 'Considering', entered: 'Entered', longlist: 'Longlisted', shortlist: 'Shortlisted', won: 'Won', 'not-placed': 'Not placed' };
export const FEEDBACK_LABEL: Record<FeedbackKind, string> = { beta: 'Beta reader', editor: 'Editor', critique: 'Critique partner', agent: 'Agent' };
export const OUTREACH_LABEL: Record<OutreachKind, string> = { reviewer: 'Reviewer', bookstore: 'Bookstore', podcast: 'Podcast', author: 'Author', press: 'Press', friend: 'Friends & family' };
export const OUTREACH_STATUS: Record<OutreachStatus, string> = { idea: 'Idea', contacted: 'Contacted', yes: 'Said yes', no: 'Said no', done: 'Done' };

/** Weeks without a reply after which a query is due a nudge (or can be closed). */
export const FOLLOW_UP_WEEKS = 8;
