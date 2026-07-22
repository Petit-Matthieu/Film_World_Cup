// ===== TMDb / 豆瓣 统一类型 =====

export interface Person {
  id: string;
  name: string;
  department: string;       // "导演" | "演员" | "导演, 演员" etc.
  avatarUrl: string | null;
}

export interface Movie {
  id: string;
  title: string;
  posterUrl: string | null;
  rating: number;           // 豆瓣评分 (0-10)
  voteCount: number;        // 评价人数
  releaseYear: string;
  popularity: number;       // 综合人气分 = rating * log10(voteCount)
}

// ===== 对阵相关 =====

export interface Matchup {
  id: string;               // "round-0-pos-3"
  roundIndex: number;       // 0 = RO32, 1 = RO16, 2 = QF, 3 = SF, 4 = FINAL
  position: number;
  filmA: Movie | null;
  filmB: Movie | null;
  winner: Movie | null;
}

export interface BracketState {
  matchups: Matchup[][];    // matchups[roundIndex][position]
  films: Movie[];
  currentRound: number;
  champion: Movie | null;
  isComplete: boolean;
}

// ===== 应用状态 =====

export type AppPhase = 'search' | 'selection' | 'bracket' | 'results';

export interface TournamentState {
  phase: AppPhase;
  person: Person | null;
  films: Movie[];
  bracket: BracketState | null;
}

// ===== Reducer Actions =====

export type TournamentAction =
  | { type: 'SET_PERSON'; person: Person }
  | { type: 'SET_FILMS'; films: Movie[] }
  | { type: 'START_BRACKET'; bracket: BracketState }
  | { type: 'VOTE'; matchupId: string; winner: Movie }
  | { type: 'SET_PHASE'; phase: AppPhase }
  | { type: 'RESET' }
  | { type: 'RESTORE_STATE'; state: TournamentState };
