/**
 * Network data, stored server-side only (network/store.ts), never in the
 * owner's app document. Members are other entrepreneurs: they have their own
 * accounts and can never reach the owner's personal data.
 */

/** Private: only the server reads it. The email is never sent to other members. */
export type MemberDoc = {
  email: string;
  passHash: string;
  createdAt: string;
  suspended?: boolean;
};

export type SessionDoc = { exp: number };

/** How precisely the member's place is shown: the nearest large city, or only the region. */
export type Precision = 'ville' | 'region';

export type ProfileDoc = {
  pseudo: string;
  company: string;
  sector: string;
  skills: string[];
  interests: string[];
  /** Nearest large city from places.ts — never an address. */
  cityId: string;
  precision: Precision;
  bio: string;
  /** Shown in discovery and counted on the map. */
  visible: boolean;
  /** Other members may start a private conversation. */
  openToMessages: boolean;
  /** Changes with each new photo, 0 when there is none. */
  photoV: number;
  updatedAt: string;
};

/** What another member sees. No email, no exact place. */
export type PublicProfile = {
  id: string;
  pseudo: string;
  photo: string | null;
  company: string;
  sector: string;
  skills: string[];
  interests: string[];
  place: { city: string | null; region: string; regionId: string; cityId: string | null };
  bio: string;
  openToMessages: boolean;
  since: string;
};

export type NetEventDoc = {
  organizer: string;
  title: string;
  description: string;
  /** YYYY-MM-DD and HH:MM, French time. */
  date: string;
  time: string;
  /** Minutes. */
  duration: number;
  cityId: string;
  /** Vague on purpose ("centre-ville", "quartier gare"); the exact place goes in the event chat. */
  placeHint: string;
  capacity?: number;
  cancelled?: boolean;
  createdAt: string;
};

export type NetEvent = Omit<NetEventDoc, 'organizer'> & {
  id: string;
  organizer: { id: string; pseudo: string; photo: string | null } | null;
  city: string;
  region: string;
  participants: number;
  joined: boolean;
  mine: boolean;
};

export type ConvDoc = {
  kind: 'dm' | 'event';
  /** Both members of a private conversation. */
  members?: [string, string];
  eventId?: string;
  lastSeq: number;
  lastAt: string;
  lastFrom: string;
  lastPreview: string;
};

/** A member's membership in a conversation, partitioned by member. */
export type ConvMemberDoc = { convId: string; lastRead: number; muted?: boolean };

export type MessageDoc = { from: string; text: string; at: string };

export type ReportKind = 'membre' | 'message' | 'evenement';

export type ReportDoc = {
  by: string;
  kind: ReportKind;
  targetId: string;
  /** The member the report is about. */
  memberId: string;
  reason: string;
  detail: string;
  /** Copy of the reported text, so moderation still sees it if it is deleted. */
  excerpt: string;
  at: string;
  status: 'ouvert' | 'traite';
  resolution?: string;
};
