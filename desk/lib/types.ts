export type SectionId =
  | 'prep'
  | 'gatekeeper'
  | 'opener'
  | 'reason'
  | 'questions'
  | 'bridge'
  | 'ask'
  | 'objections'
  | 'voicemail'
  | 'booked'
  | 'followup';

export interface Section {
  id: SectionId;
  label: string;
  body: string; // current text (Dean's edit if he made one)
  original: string; // what The Mastermind wrote
  edited: boolean;
  editedAt?: string;
}

export type Outcome =
  | 'booked'
  | 'callback'
  | 'no-answer'
  | 'voicemail'
  | 'gatekeeper'
  | 'info'
  | 'lost'
  | 'dnc'
  | 'wrong-number';

export const OUTCOME_LABEL: Record<Outcome, string> = {
  booked: 'Meeting booked',
  callback: 'Callback',
  'no-answer': 'No answer',
  voicemail: 'Voicemail left',
  gatekeeper: 'Gatekeeper',
  info: 'Asked for info',
  lost: 'Lost',
  dnc: 'Do not call',
  'wrong-number': 'Wrong number',
};

/** Order in the dropdown. */
export const OUTCOMES: Outcome[] = ['booked', 'callback', 'no-answer', 'voicemail', 'gatekeeper', 'info', 'lost', 'dnc', 'wrong-number'];
export const LOST_OUTCOMES: Outcome[] = ['lost', 'dnc', 'wrong-number'];
export const CONVERSATION_OUTCOMES: Outcome[] = ['booked', 'callback', 'info', 'lost', 'dnc'];

export const LOST_REASONS = ['Not interested', 'Already have someone', 'Too expensive', 'Bad timing', 'Not a fit', 'Not the decision maker'];
export const STAGES = ['Gatekeeper', 'Opener', 'Reason', 'Questions', 'Ask', 'Objection'];

export interface Call {
  at: string;
  outcome: Outcome;
  note?: string;
  lostReason?: string;
  stage?: string;
  callbackAt?: string;
}

export interface Signal {
  text: string;
  source: string;
  date: string;
  confidence: string;
}

export type Status = 'to-call' | 'callback' | 'booked' | 'lost';

export interface Lead {
  id: string;
  demo?: boolean;
  company: string;
  contact: string;
  role: string;
  phone: string;
  website: string;
  email?: string;
  instagram?: string;
  town: string;
  niche: string;
  signals: Signal[];
  bestTime: string;
  tps: { checked: boolean; checkedAt?: string };
  script: {
    id: string;
    templateId: string;
    pattern: string;
    slot: string;
    variable: string;
    writtenAt: string;
    sections: Section[];
  };
  status: Status;
  callbackAt?: string;
  calls: Call[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateSection {
  id: SectionId;
  body: string;
}

export interface Template {
  id: string;
  name: string;
  letter: string;
  pattern: string;
  status: 'testing' | 'champion' | 'active' | 'retired';
  variable: string;
  createdAt: string;
  why: string;
  sections: TemplateSection[];
}

export interface Niche {
  id: string;
  label: string;
  examples: string;
  bestTime: string;
  pain: string;
  hedgedPainLine: string;
  variables: Record<string, string>;
  templates: Template[];
}

export interface LeadFile {
  lead: Lead;
  sha?: string;
}

export type LeadOp =
  | { op: 'log'; outcome: Outcome; note?: string; lostReason?: string; stage?: string; callbackAt?: string }
  | { op: 'undo' }
  | { op: 'restore' }
  | { op: 'edit'; sectionId: SectionId; body: string }
  | { op: 'revert'; sectionId: SectionId }
  | { op: 'tps'; checked: boolean }
  | { op: 'notes'; notes: string }
  | { op: 'profile'; profile: Partial<Profile> };

/** Company details Dean can edit from the desk. */
export const PROFILE_FIELDS = ['company', 'contact', 'role', 'phone', 'town', 'website', 'email', 'instagram', 'bestTime'] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];
export type Profile = Record<ProfileField, string>;
export const PROFILE_LABEL: Record<ProfileField, string> = {
  company: 'Company',
  contact: 'Contact name',
  role: 'Role',
  phone: 'Phone',
  town: 'Town / area',
  website: 'Website',
  email: 'Email',
  instagram: 'Instagram',
  bestTime: 'Best time to ring',
};

export const SECTION_LABEL: Record<SectionId, string> = {
  prep: 'Before you dial',
  gatekeeper: 'If someone else answers',
  opener: 'Opener',
  reason: "Why I'm calling",
  questions: 'Questions',
  bridge: "If it's a problem for them",
  ask: 'The ask',
  objections: 'If they push back',
  voicemail: 'Voicemail',
  booked: 'When they say yes',
  followup: 'Text after the call',
};

export const PATTERN_LABEL: Record<string, string> = {
  permission: 'Permission opener',
  direct: 'Straight to the reason',
  context: 'Context first',
  interrupt: 'Pattern interrupt',
};
