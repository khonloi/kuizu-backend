export interface VerificationEmailPayload {
  to: string;
  username: string;
  token: string;
}

export interface PasswordResetEmailPayload {
  to: string;
  username: string;
  token: string;
}

export interface PlayerReportItem {
  nickname: string;
  score: number;
  rank: number;
}

export interface GameSessionReportPayload {
  pin: string;
  hostUserId?: string | null;
  quizId: string;
  quizTitle: string;
  players: PlayerReportItem[];
}

export interface LeagueCalculationPayload {
  timestamp?: string;
}
