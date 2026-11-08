// Shared shapes. Question banks live in lib/papers/<id>/ as plain JS modules.

export type Lang = "python" | "java" | "cpp";
export type Dialect = "mysql" | "spark";

export type TestCase = {
  input?: string;
  expected: unknown;
  sample?: boolean;
  show?: string;
  data?: Record<string, unknown[][]>;
};

export type SqlTable = { name: string; columns: { name: string; type: string }[] };

export type CodingSpec = {
  kind: "dsa" | "sql";
  output?: "int" | "list" | "string";
  ordered?: boolean;
  tables?: SqlTable[];
  starter: Record<Lang, string> | string;
  prelude?: Record<string, string>;
  driver?: Record<string, string>;
  tests: TestCase[];
};

export type Mcq = { id: string; topic: string; q: string; code?: string | null; options: string[]; answer: number; why?: string };
export type Set2Q = { id: string; type: string; marks: number; title: string; link?: string; prompt: string; coding?: CodingSpec };

export type PaperConfig = {
  title: string;
  durationMinutes: number;
  set1MarkPerQuestion: number;
  set1NegativeMark: number;
  showScoreToCandidate: boolean;
};

export type Set1Result = {
  score: number;
  max: number;
  byTopic: Record<string, { correct: number; wrong: number; skipped: number; total: number }>;
  detail: { id: string; chosen: number | null; correct: boolean }[];
};

/** What the candidate's browser receives: no answers, and only the sample tests. */
export type PublicSet2Q = Omit<Set2Q, "link" | "coding"> & {
  link?: string;
  coding?: Omit<CodingSpec, "tests"> & { tests: TestCase[]; hiddenCount: number };
};
export type PublicPaper = {
  id: string;
  config: Pick<PaperConfig, "title" | "durationMinutes" | "set1MarkPerQuestion" | "set1NegativeMark">;
  set1: Omit<Mcq, "answer" | "why">[];
  set2: PublicSet2Q[];
};

// ── stored records ──
export type Role = "admin" | "student";

export type Student = {
  email: string;
  name?: string;
  image?: string;
  addedAt: number;
  addedBy: string;
  lastLoginAt?: number;
};

export type Assessment = {
  id: string;
  title: string;
  paperId: string;
  durationMinutes: number;
  opensAt: number | null;
  closesAt: number | null;
  releaseResults: boolean;
  /** camera + mic, full-screen share and location required to start (default on) */
  proctoring?: boolean;
  archived?: boolean;
  createdAt: number;
  createdBy: string;
};

export type MailStatus = { status: "sent" | "failed" | "skipped"; at: number; error?: string };

export type Attempt = {
  assessmentId: string;
  email: string;
  invitedAt: number;
  invitedBy: string;
  mail?: MailStatus;
  startedAt?: number;
  submittedAt?: number;
  submissionId?: string;
  location?: { lat: number; lon: number; acc: number };
};

export type Set2Answer = {
  id: string;
  answer: string;
  marks: number | null;
  note: string;
  lang?: string | null;
  run?: { passed: number; total: number; at: number | null; lang: string | null; stale: boolean } | null;
};

export type Submission = {
  id: string;
  name: string;
  email?: string;
  assessmentId?: string; // missing on submissions made before accounts existed → "mock-01"
  startedAt: number;
  submittedAt: number;
  timeTakenSec: number;
  autoSubmitted: boolean;
  late?: boolean;
  tabSwitches: number;
  set1: Set1Result;
  set2: Set2Answer[];
};

export type Viewer = { email: string; name: string; image?: string; role: Role };
