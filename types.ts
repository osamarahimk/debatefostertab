export enum TournamentFormat {
    BP = 'BP',
    WSDC = 'WSDC',
    AP = 'AP',
}

export interface Speaker {
  id: string;
  name: string;
  categoryIds?: string[];
}

export interface Team {
  id: string;
  name: string;
  speakers: Speaker[];
  wins: number; // For WSDC/AP
  teamPoints: number; // For BP
  totalSpeakerPoints: number;
  opponents: string[]; // List of opponent team IDs
  positionsSpoken: TeamPositionBp[]; // Only BP has complex position tracking for now
  breakCategoryIds?: string[];
}

export interface Judge {
  id: string;
  name:string;
  affiliation: string; // School or institution to check for conflicts
  roundsJudged: number;
}

// --- British Parliamentary (BP) Specific Types ---
export type TeamPositionBp = 'ogTeam' | 'ooTeam' | 'cgTeam' | 'coTeam';

export interface TeamResultBp {
    teamId: string;
    rank: 1 | 2 | 3 | 4;
    speakerPoints: number[];
}

export interface BallotBp {
  type: TournamentFormat.BP;
  ranks: TeamResultBp[];
  chairJudgeId: string | null;
}

export interface PairingBp {
  id: string;
  type: TournamentFormat.BP;
  roundId: string;
  ogTeam: Team;
  ooTeam: Team;
  cgTeam: Team;
  coTeam: Team;
  judges: Judge[];
  ballot: BallotBp | null;
  room: string;
}

// --- WSDC / AP Specific Types ---
export type TeamPositionWsdcAp = 'propTeam' | 'oppTeam';

export interface BallotWsdcAp {
    type: TournamentFormat.WSDC | TournamentFormat.AP;
    winner: 'prop' | 'opp';
    propScores: number[]; // e.g., [Speaker1, Speaker2, Speaker3]
    oppScores: number[];
    propReplyScore: number;
    oppReplyScore: number;
    chairJudgeId: string | null;
}

export interface PairingWsdcAp {
    id: string;
    type: TournamentFormat.WSDC | TournamentFormat.AP;
    roundId: string;
    propTeam: Team;
    oppTeam: Team;
    judges: Judge[];
    ballot: BallotWsdcAp | null;
    room: string;
}

// --- Union Types for Generic Use ---
export type Pairing = PairingBp | PairingWsdcAp;
export type Ballot = BallotBp | BallotWsdcAp;
export type TeamPosition = TeamPositionBp | TeamPositionWsdcAp;

export type PairingAlgorithm = 'random' | 'power-paired-fold' | 'power-paired-slide';

export interface Round {
  id: string;
  roundNumber: number;
  motion: string;
  pairings: Pairing[];
  isSilent: boolean; // Whether to show results for this round
  status: 'draft' | 'results';
  pairingAlgorithm?: PairingAlgorithm;
}

export interface BreakCategory {
  id: string;
  name: string;
}

export interface SpeakerCategory {
  id: string;
  name: string;
}

export interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  teams: Team[];
  judges: Judge[];
  rounds: Round[];
  breakAfterRound?: number;
  breakCategories?: BreakCategory[];
  speakerCategories?: SpeakerCategory[];
}

export enum View {
  SETUP = 'Setup',
  TEAMS = 'Teams',
  JUDGES = 'Judges',
  ROUNDS = 'Rounds',
  STANDINGS = 'Standings'
}