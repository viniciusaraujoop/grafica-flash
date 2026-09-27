/**
 * Orçaly Academy — domain types (isolated MVP, pure TypeScript).
 *
 * Personal learning continuity: library + tracks + reading + progress + notes.
 * Nothing is invented: unknown author, license, duration or progress stays UNKNOWN.
 * Percentages are integer basis points (0..10000); no float is a source of truth.
 */

export const CONTENT_TYPES = ['ARTICLE', 'LESSON', 'VIDEO', 'AUDIO', 'DOCUMENT', 'COURSE', 'TRACK'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

export const PUBLICATION_STATUSES = ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED', 'BLOCKED_LICENSE'] as const
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number]

export const AVAILABILITIES = ['AVAILABLE', 'COMING_SOON', 'BLOCKED_LICENSE', 'EXTERNAL_ONLY', 'UNAVAILABLE'] as const
export type Availability = (typeof AVAILABILITIES)[number]

export const LICENSE_TYPES = ['ORIGINAL', 'PUBLIC_DOMAIN', 'LICENSED', 'USER_PROVIDED', 'EXTERNAL_LINK', 'UNKNOWN'] as const
export type LicenseType = (typeof LICENSE_TYPES)[number]

export const LICENSE_STATUSES = ['VERIFIED', 'DECLARED', 'NOT_VERIFIED', 'EXPIRED', 'NOT_APPLICABLE'] as const
export type LicenseStatus = (typeof LICENSE_STATUSES)[number]

export const PROGRESS_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number]

export const COMPLETION_POLICIES = ['MANUAL', 'READING_THRESHOLD', 'PLAYBACK_THRESHOLD', 'ALL_REQUIRED_ITEMS'] as const
export type CompletionPolicyKind = (typeof COMPLETION_POLICIES)[number]

export const MEDIA_STATES = ['NOT_CONFIGURED', 'EXTERNAL_ONLY', 'AVAILABLE_METADATA_ONLY'] as const
export type MediaState = (typeof MEDIA_STATES)[number]

/** A value that may be real, unknown or not applicable. 0 is a real value, never a stand-in. */
export type Known<T> = { kind: 'KNOWN'; value: T } | { kind: 'UNKNOWN'; reason: string } | { kind: 'NOT_APPLICABLE' }

export type AcademyAuthor = { id: string; name: string } | null
export type AcademyCategory = { id: string; label: string }

export type AcademyLicense = {
  type: LicenseType
  status: LicenseStatus
  /** Rights holder when applicable (null = not declared). */
  rightsHolder: string | null
  verifiedAt: string | null
  expiresAt: string | null
  /** Free text: what evidence backs the license (contract id, public-domain proof…). */
  evidence: string | null
}

export type AcademySource = {
  type: 'ORCALY_ORIGINAL' | 'PUBLISHER' | 'USER' | 'EXTERNAL'
  label: string
  /** Canonical https URL when applicable. */
  canonicalUrl: string | null
}

export type CompletionPolicy =
  | { kind: 'MANUAL' }
  | { kind: 'READING_THRESHOLD'; thresholdBps: number }
  | { kind: 'PLAYBACK_THRESHOLD'; thresholdBps: number }
  | { kind: 'ALL_REQUIRED_ITEMS' }

/** Structure of readable content: ordered, uniquely anchored sections. Text is plain (never raw HTML). */
export type ContentSection = { anchor: string; heading: string; paragraphs: readonly string[] }

export type MediaInfo = {
  state: MediaState
  transcript: 'AVAILABLE' | 'NOT_AVAILABLE' | 'UNKNOWN'
  captions: 'AVAILABLE' | 'NOT_AVAILABLE' | 'UNKNOWN'
}

export type AcademyContentItem = {
  id: string
  type: Exclude<ContentType, 'TRACK'>
  title: string
  subtitle: string | null
  author: AcademyAuthor
  source: AcademySource
  license: AcademyLicense
  publication: PublicationStatus
  /** Declared duration in seconds (media) or minutes of reading; UNKNOWN when not declared. */
  duration: Known<number>
  /** For documents: known page count. */
  pages: Known<number>
  language: string
  categories: readonly string[]
  tags: readonly string[]
  completion: CompletionPolicy
  sections: readonly ContentSection[] | null
  media: MediaInfo | null
  publishedAt: string | null
  /** Marks synthetic demo content. */
  sample: boolean
}

export type AcademyTrackItem = {
  contentId: string
  position: number
  required: boolean
  /** Content ids (within the same track) that must be completed first. */
  prerequisites: readonly string[]
}

export type AcademyTrack = {
  id: string
  title: string
  description: string
  items: readonly AcademyTrackItem[]
  estimatedMinutes: Known<number>
  publication: PublicationStatus
  progressPolicy: 'COUNT_REQUIRED_ITEMS'
  completion: { kind: 'ALL_REQUIRED_ITEMS' }
  categories: readonly string[]
  sample: boolean
}

export type AcademyEnrollment = { trackId: string; userId: string; enrolledAt: string; status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' }

/** Resume position, typed by content kind. */
export type ResumePosition =
  | { kind: 'ANCHOR'; anchor: string }
  | { kind: 'SECONDS'; seconds: number }
  | { kind: 'PAGE'; page: number }

export type AcademyProgress = {
  contentId: string
  userId: string
  status: ProgressStatus
  startedAt: string | null
  lastSeenAt: string | null
  completedAt: string | null
  position: ResumePosition | null
  /** Reading/playback progress in basis points; UNKNOWN when not measured. */
  progress: Known<number>
  version: number
}

export type AcademyLearningSession = {
  id: string
  contentId: string
  userId: string
  startedAt: string
  endedAt: string | null
  /** Only when reliably measured (e.g. visible + interacting). Tab-open time is NOT study time. */
  activeSeconds: Known<number>
  resume: ResumePosition | null
  completion: 'NONE' | 'COMPLETED'
}

export type AcademyNote = {
  id: string
  userId: string
  contentId: string
  anchor: string | null
  seconds: number | null
  text: string
  createdAt: string
  updatedAt: string
  version: number
  sample: boolean
}

export type AcademyBookmark = {
  id: string
  userId: string
  contentId: string
  target: { kind: 'CONTENT' } | { kind: 'ANCHOR'; anchor: string } | { kind: 'SECONDS'; seconds: number }
  createdAt: string
}

export type AcademyCompletionEvent = {
  id: string
  userId: string
  contentId: string
  policy: CompletionPolicyKind
  evidence: string
  at: string
}

export type AcademySearchDocument = {
  id: string
  kind: 'CONTENT' | 'TRACK'
  title: string
  subtitle: string
  author: string
  categories: readonly string[]
  tags: readonly string[]
}

export type AcademyLibraryState = {
  userId: string
  items: readonly AcademyContentItem[]
  tracks: readonly AcademyTrack[]
  enrollments: readonly AcademyEnrollment[]
  progress: readonly AcademyProgress[]
  notes: readonly AcademyNote[]
  bookmarks: readonly AcademyBookmark[]
  categories: readonly AcademyCategory[]
}
