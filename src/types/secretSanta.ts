export type ThemeId = 'santa' | 'chocolate' | 'funny';

export type GenderCategory = 'all' | 'female' | 'male' | 'neutral';

export type AppStep =
  | 'invitation'
  | 'start'
  | 'join'
  | 'avatar'
  | 'details'
  | 'hub';

export type ImportProvider = 'blinkit' | 'amazon' | 'zomato' | 'flipkart';

export interface ParticipantAddress {
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
}

export interface ParticipantProfile {
  id: string;
  eventId: string;
  invitationHash: string;
  name: string;
  address: ParticipantAddress;
  hobbies: string[];
  avatarId: string;
  genderPreference: GenderCategory;
  selectedTheme: ThemeId;
  hasJoined: boolean;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export type GiftBudgetMode = 'fixed' | 'range';

export interface GiftBudgetConfig {
  mode: GiftBudgetMode;
  currency: string;
  minAmount: number;
  maxAmount: number;
  announcement: string;
}

export interface SecretSantaEvent {
  id: string;
  name: string;
  timezone: string;
  registrationOpen: boolean;
  registrationDeadline: Date;
  gifteeRevealAt: Date;
  giftDeadline: Date;
  santaIdentityRevealAt: Date;
  isMatched: boolean;
  matchedAt: Date | null;
  participantCount: number;
  createdBy: string;

  // Phase 2 Event Configuration
  budget: GiftBudgetConfig;
  mailboxEnabled: boolean;
  mailboxOpenAt: Date;
  mailboxCloseAt: Date;
  guessingEnabled: boolean;
  maxGuesses: number;
  allowDuplicateGuesses: boolean;
  adventEnabled: boolean;
  adventStartAt: Date;
  adventEndAt: Date;
  adventAllowCatchUp: boolean;
  wheelEnabled: boolean;
  elfChallengeEnabled: boolean;
  quizEnabled: boolean;
  quizAllowRetake: boolean;
  deliveryTrackingEnabled: boolean;
  allowSharedTrackingLink: boolean;
  thankYouEnabled: boolean;
  snowGlobeRevealEnabled: boolean;
  giftPreferencesCutoffAt: Date;
}

export interface InvitationRecord {
  tokenHash: string;
  eventId: string;
  label: string;
  status: 'pending' | 'claimed' | 'revoked';
  participantKey: string;
  expiresAt: Date;
  createdAt: Date;
  claimedAt: Date | null;
  isRecovery?: boolean;
  recoveryParticipantKey?: string;
}

export interface GiftDislikesShareable {
  dislikedCategories: string[];
  dietaryRestrictions: string[];
  dislikedColors: string[];
  alreadyOwned: string[];
  nonFoodNotes: string;
  generalNotes: string;
}

export interface GiftPreferencesRecord {
  eventId: string;
  participantKey: string;
  dislikedCategories: string[];
  dietaryRestrictions: string[];
  dislikedColors: string[];
  alreadyOwned: string[];
  nonFoodNotes: string;
  generalNotes: string;
  shareWithSanta: boolean;
  shareDietaryWithSanta: boolean;
  updatedAt: Date;
}

export interface MatchAssignment {
  eventId: string;
  giverKey: string;
  outgoingAssignmentId: string;
  recipientName: string;
  recipientAvatarId: string;
  recipientHobbies: string[];
  recipientAddress: ParticipantAddress;
  recipientDislikes?: GiftDislikesShareable | null;
}

/**
 * Strictly anonymous incoming assignment handle.
 * NEVER contains sender name, avatar, hobbies, or giverKey!
 */
export interface IncomingAssignment {
  eventId: string;
  recipientKey: string;
  incomingAssignmentId: string;
}

export interface SantaIdentityReveal {
  eventId: string;
  recipientKey: string;
  santaPublicId?: string;
  santaName: string;
  santaAvatarId: string;
  santaHobbies: string[];
}

export interface PublicRosterEntry {
  publicId: string;
  name: string;
  avatarId: string;
}

export interface AvatarDefinition {
  id: string;
  name: string;
  category: 'female' | 'male' | 'neutral';
  bgFrom: string;
  bgTo: string;
  skin: string;
  hairColor: string;
  hatStyle:
    | 'santa'
    | 'beanie'
    | 'reindeer'
    | 'elf'
    | 'penguin'
    | 'hijab-santa'
    | 'headphones'
    | 'earmuffs'
    | 'bow'
    | 'goggles'
    | 'holly'
    | 'antlers'
    | 'buns'
    | 'gingerbread'
    | 'snowman'
    | 'none';
  sweaterColor: string;
  scarfColor?: string;
  hasGlasses?: boolean;
  hasBeard?: boolean;
  hasRedNose?: boolean;
  hairStyle: 'long' | 'short' | 'curly' | 'bun' | 'twin-buns' | 'braids' | 'none';
  expression: 'happy' | 'wink' | 'excited' | 'cozy';
}

export interface HobbyOption {
  id: string;
  label: string;
  emoji: string;
}

export interface AdminAccount {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}

// ---------- Phase 2 Feature Types ----------

export type MailboxRole = 'santa' | 'recipient';

export interface AnonymousMessage {
  id: string;
  assignmentId: string;
  eventId: string;
  senderRole: MailboxRole;
  body: string;
  createdAt: Date;
  readByOther: boolean;
  reported: boolean;
  reportReason?: string;
}

export interface AnonymousConversationMeta {
  assignmentId: string;
  eventId: string;
  messageCount: number;
  unreadForSanta: number;
  unreadForRecipient: number;
  lastMessageAt: Date | null;
  lastSenderRole: MailboxRole | null;
}

export interface SantaGuessItem {
  guessedPublicId: string;
  guessedName: string;
  guessedAvatarId: string;
  reaction: string;
  submittedAtIso: string;
}

export interface SantaGuessRecord {
  eventId: string;
  participantKey: string;
  guesses: SantaGuessItem[];
  updatedAt: Date;
}

export type DeliveryStage =
  | 'preparing'
  | 'shopping'
  | 'wrapped'
  | 'dispatched'
  | 'delivered';

export interface DeliveryHistoryEntry {
  stage: DeliveryStage;
  note: string;
  atIso: string;
}

export interface DeliveryProgressRecord {
  assignmentId: string;
  eventId: string;
  stage: DeliveryStage;
  history: DeliveryHistoryEntry[];
  sharedNote: string;
  updatedAt: Date;
}

export interface DeliveryPrivateTrackingRecord {
  eventId: string;
  participantKey: string;
  courierName: string;
  trackingCode: string;
  privateNote: string;
  updatedAt: Date;
}

export type DeliveryAckStatus = 'pending' | 'received' | 'problem';

export interface DeliveryAcknowledgmentRecord {
  assignmentId: string;
  eventId: string;
  status: DeliveryAckStatus;
  acknowledgedAt: Date | null;
  problemSummary: string;
  adminCorrectionNote: string;
  correctedBy: string;
  updatedAt: Date;
}

export type AdventRewardKind =
  | 'joke'
  | 'trivia'
  | 'fortune'
  | 'ornament'
  | 'challenge'
  | 'animation'
  | 'badge';

export interface AdventDaySurprise {
  day: number;
  title: string;
  kind: AdventRewardKind;
  message: string;
  emoji: string;
  collectibleId?: string;
  collectibleName?: string;
  collectibleEmoji?: string;
  globeDecorType?: string;
}

export interface AdventUnlockRecord {
  id: string;
  eventId: string;
  participantKey: string;
  day: number;
  rewardKind: AdventRewardKind;
  collectibleId: string;
  collectibleName: string;
  collectibleEmoji: string;
  unlockedAt: Date;
}

export interface WheelPrizeDefinition {
  id: string;
  slotIndex: number;
  label: string;
  shortLabel: string;
  emoji: string;
  kind: 'fortune' | 'badge' | 'joke' | 'challenge' | 'ornament' | 'animation' | 'title';
  message: string;
  color: string;
  weight: number;
  collectibleId?: string;
  collectibleName?: string;
}

export interface DailyWheelSpinRecord {
  id: string;
  eventId: string;
  participantKey: string;
  dateKey: string;
  prizeId: string;
  slotIndex: number;
  prizeLabel: string;
  prizeMessage: string;
  prizeEmoji: string;
  collectibleId: string;
  collectibleName: string;
  spunAt: Date;
}

export interface NaughtyNiceQuizResult {
  eventId: string;
  participantKey: string;
  quizVersion: string;
  nicePercent: number;
  naughtyPercent: number;
  verdictTitle: string;
  verdictSubtitle: string;
  stampLabel: string;
  answers: number[];
  completedAt: Date;
}

export type ElfHidingSpotId =
  | 'tree'
  | 'mailbox'
  | 'giftbox'
  | 'calendar'
  | 'footer'
  | 'snowsign';

export interface ElfDiscoveryRecord {
  id: string;
  eventId: string;
  participantKey: string;
  dateKey: string;
  challengeId: string;
  spotId: ElfHidingSpotId;
  rewardTitle: string;
  rewardEmoji: string;
  collectibleId: string;
  discoveredAt: Date;
}

export type GingerbreadShape = 'person' | 'tree' | 'star' | 'reindeer';
export type GingerbreadIcingColor = 'white' | 'pink' | 'red' | 'green' | 'chocolate';
export type GingerbreadDecorationType =
  | 'sprinkles'
  | 'button'
  | 'eye'
  | 'bowtie'
  | 'santa-hat'
  | 'scarf'
  | 'choco-chip'
  | 'heart'
  | 'snowflake'
  | 'svg-eye-outline'
  | 'svg-eye-brown'
  | 'svg-bow-pink'
  | 'svg-bowtie-navy'
  | 'svg-hat-butterfly'
  | 'svg-hat-fedora'
  | 'svg-scarf-cozy'
  | 'svg-scarf-long'
  | 'svg-glasses-sparkle'
  | 'svg-glasses-retro'
  | 'svg-glasses-reading'
  | 'svg-snow-globe'
  | 'svg-holly'
  | 'svg-candy-cane'
  | 'svg-gift-box'
  | 'svg-string-lights'
  | 'svg-gold-star'
  | 'svg-ball-star'
  | 'svg-ball-red'
  | 'svg-bauble-green-red'
  | 'svg-bauble-gold-red';

export interface GingerbreadDecorationItem {
  id: string;
  type: GingerbreadDecorationType;
  x: number; // 0..100 percentage inside cookie canvas
  y: number; // 0..100 percentage inside cookie canvas
  scale: number; // 0.6..1.6
  rotation: number; // -45..45 degrees
}

export interface GingerbreadDesign {
  eventId: string;
  participantKey: string;
  shape: GingerbreadShape;
  icingColor: GingerbreadIcingColor;
  decorations: GingerbreadDecorationItem[];
  isPublicProfileDecor: boolean;
  updatedAt?: Date;
}

export type ThankYouTemplateId =
  | 'santa-heart'
  | 'reindeer-hug'
  | 'snowman-wave'
  | 'gingerbread-dance'
  | 'choco-hearts';

export interface ThankYouCardRecord {
  assignmentId: string;
  eventId: string;
  templateId: ThankYouTemplateId;
  message: string;
  reactions: string[];
  createdAt: Date;
}

export interface SnowGlobePlacedOrnament {
  id: string;
  collectibleId: string;
  label: string;
  emoji: string;
  x: number; // 15..85
  y: number; // 20..78
}

export interface SnowGlobeConfigRecord {
  eventId: string;
  participantKey: string;
  decorations: SnowGlobePlacedOrnament[];
  updatedAt: Date;
}

export interface SessionRecoveryRequestRecord {
  id: string;
  eventId: string;
  requestedName: string;
  verificationHint: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: Date;
  resolvedBy?: string;
}

export interface RecoveryAuditLogRecord {
  id: string;
  eventId: string;
  action: 'recovery_issued' | 'invite_revoked' | 'ack_corrected' | 'request_dismissed';
  actorEmail: string;
  targetLabel: string;
  note: string;
  createdAt: Date;
}

export type WorkshopFeatureId =
  | 'overview'
  | 'reveal'
  | 'mailbox-outgoing'
  | 'mailbox-incoming'
  | 'delivery-outgoing'
  | 'delivery-incoming'
  | 'dislikes'
  | 'thank-you'
  | 'thank-you-received'
  | 'guess-santa'
  | 'advent'
  | 'wheel'
  | 'naughty-nice'
  | 'hidden-elf'
  | 'gingerbread'
  | 'snow-globe';
