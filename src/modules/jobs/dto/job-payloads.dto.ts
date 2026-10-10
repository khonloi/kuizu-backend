export interface BaseJobPayload {
  correlationId?: string;
}

export interface VerificationEmailPayload extends BaseJobPayload {
  to: string;
  username: string;
  token: string;
}

export interface PasswordResetEmailPayload extends BaseJobPayload {
  to: string;
  username: string;
  token: string;
}

export interface PlayerReportItem {
  nickname: string;
  score: number;
  rank: number;
}

export interface GameSessionReportPayload extends BaseJobPayload {
  pin: string;
  hostUserId?: string | null;
  quizId: string;
  quizTitle: string;
  players: PlayerReportItem[];
}

export interface LeagueCalculationPayload extends BaseJobPayload {
  timestamp?: string;
}
