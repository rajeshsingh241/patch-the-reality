// ─── Enums / Union Types ───────────────────────────────────────────────────────

export type BadgeLevel = "Newcomer" | "Contributor" | "Trusted" | "Expert";
export type FlagLevel = "safe" | "warning" | "blocked";
export type PollStatus = "active" | "closed" | "blocked";
export type VoteChoice = "yes" | "no";
export type ContentType = "image" | "video" | "text";
export type LedgerReason =
  | "correct_vote"
  | "wrong_vote"
  | "poll_created"
  | "ai_fraud_detected"
  | "whistleblower_bonus"
  | "cashout";

// ─── Row Types (what Supabase returns) ────────────────────────────────────────

export interface UserRow {
  id: string;
  wallet_address: string;
  username: string | null;
  token_balance: number;
  reputation_score: number;
  total_votes: number;
  correct_votes: number;
  accuracy_percentage: number;
  badge_level: BadgeLevel;
  created_at: string;
}

export interface PollRow {
  id: string;
  created_by: string;
  content_url: string | null;
  content_type: ContentType;
  user_description: string;
  ai_generated_question: string;
  flag_level: FlagLevel;
  flag_reason: string | null;
  flag_confidence: number;
  status: PollStatus;
  yes_votes: number;
  no_votes: number;
  correct_answer: VoteChoice | null;
  created_at: string;
  closes_at: string;
}

export interface VoteRow {
  id: string;
  poll_id: string;
  user_id: string;
  vote: VoteChoice;
  is_correct: boolean | null;
  tokens_awarded: number | null;
  created_at: string;
}

export interface TokenLedgerRow {
  id: string;
  user_id: string;
  amount: number;
  reason: LedgerReason;
  poll_id: string | null;
  created_at: string;
}

// ─── Insert Types ─────────────────────────────────────────────────────────────
// Fields with DB defaults are optional. Required = no default in SQL schema.

export interface UserInsert {
  id?: string;
  wallet_address: string;
  username?: string | null;
  token_balance?: number;
  reputation_score?: number;
  total_votes?: number;
  correct_votes?: number;
  accuracy_percentage?: number;
  badge_level?: BadgeLevel;
  created_at?: string;
}

export interface PollInsert {
  id?: string;
  created_by: string;
  content_url?: string | null;
  content_type: ContentType;
  user_description?: string;
  ai_generated_question: string;
  flag_level: FlagLevel;
  flag_reason?: string | null;
  flag_confidence?: number;
  status?: PollStatus;
  yes_votes?: number;
  no_votes?: number;
  correct_answer?: VoteChoice | null;
  created_at?: string;
  closes_at?: string;
}

export interface VoteInsert {
  id?: string;
  poll_id: string;
  user_id: string;
  vote: VoteChoice;
  is_correct?: boolean | null;
  tokens_awarded?: number | null;
  created_at?: string;
}

export interface TokenLedgerInsert {
  id?: string;
  user_id: string;
  amount: number;
  reason: LedgerReason;
  poll_id?: string | null;
  created_at?: string;
}

// ─── Update Types ─────────────────────────────────────────────────────────────

export interface UserUpdate {
  username?: string | null;
  token_balance?: number;
  reputation_score?: number;
  total_votes?: number;
  correct_votes?: number;
  accuracy_percentage?: number;
  badge_level?: BadgeLevel;
}

export interface PollUpdate {
  content_url?: string | null;
  content_type?: ContentType;
  user_description?: string;
  ai_generated_question?: string;
  flag_level?: FlagLevel;
  flag_reason?: string | null;
  flag_confidence?: number;
  status?: PollStatus;
  yes_votes?: number;
  no_votes?: number;
  correct_answer?: VoteChoice | null;
  closes_at?: string;
}

export interface VoteUpdate {
  vote?: VoteChoice;
  is_correct?: boolean | null;
  tokens_awarded?: number | null;
}

export interface TokenLedgerUpdate {
  amount?: number;
  reason?: LedgerReason;
  poll_id?: string | null;
}

// ─── Supabase JS v2 Database Generic ──────────────────────────────────────────
// GenericSchema (from @supabase/supabase-js) only requires Tables, Views, Functions.
// Each table entry must have Relationships: GenericRelationship[].
// Views and Functions use the empty mapped type { [_ in never]: never } which
// satisfies Record<string, GenericView> and Record<string, GenericFunction>.

export type Database = {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: UserInsert;
        Update: UserUpdate;
        Relationships: [];
      };
      polls: {
        Row: PollRow;
        Insert: PollInsert;
        Update: PollUpdate;
        Relationships: [];
      };
      votes: {
        Row: VoteRow;
        Insert: VoteInsert;
        Update: VoteUpdate;
        Relationships: [];
      };
      token_ledger: {
        Row: TokenLedgerRow;
        Insert: TokenLedgerInsert;
        Update: TokenLedgerUpdate;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
  };
};

// ─── Extended / API Response Types ────────────────────────────────────────────

/** Poll as returned by the feed API — includes time remaining and creator info */
export interface PollFeedItem extends PollRow {
  time_remaining_seconds: number;
  total_votes: number;
  creator_username: string | null;
}

/** Token ledger entry enriched with the poll's AI-generated question */
export interface TokenLedgerWithPoll extends TokenLedgerRow {
  poll_question: string | null;
}

/** Full user profile returned by GET /api/users/profile/:wallet_address */
export interface UserProfileResponse extends UserRow {
  recent_activity: TokenLedgerWithPoll[];
  polls_published: number;
  tokens_to_next_cashout: number;
}

/** Generic API response wrapper used by all routes */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
