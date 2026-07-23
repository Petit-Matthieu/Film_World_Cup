import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { TournamentState, TournamentAction, Person, Movie, BracketState, AppPhase } from '../types';
import * as bracket from '../utils/bracket';
import { saveState, loadState, clearState } from '../utils/storage';

// ===== 初始状态 =====

const initialState: TournamentState = {
  phase: 'search',
  person: null,
  films: [],
  bracket: null,
};

// ===== Reducer =====

function tournamentReducer(
  state: TournamentState,
  action: TournamentAction
): TournamentState {
  switch (action.type) {
    case 'SET_PERSON':
      return {
        ...initialState,  // 完全重置
        person: action.person,
      };

    case 'SET_FILMS':
      return {
        ...state,
        films: action.films,
        phase: 'selection',
      };

    case 'START_BRACKET':
      return {
        ...state,
        bracket: action.bracket,
        phase: 'bracket',
      };

    case 'VOTE': {
      if (!state.bracket) return state;
      const currentMatchup = state.bracket.matchups[state.bracket.currentRound]?.find(
        (m) => m.id === action.matchupId
      );
      if (!currentMatchup) return state;

      const newMatchups = bracket.propagateWinner(
        state.bracket.matchups,
        { ...currentMatchup, winner: action.winner }
      );

      const roundComplete = bracket.isRoundComplete(
        newMatchups,
        state.bracket.currentRound
      );

      const champion = bracket.getChampion(newMatchups);
      const isComplete = champion !== null;

      let nextRound = state.bracket.currentRound;
      let nextPhase: AppPhase = 'bracket';

      if (isComplete) {
        nextPhase = 'results';
      } else if (roundComplete) {
        nextRound = state.bracket.currentRound + 1;
      }

      return {
        ...state,
        phase: nextPhase,
        bracket: {
          ...state.bracket,
          matchups: newMatchups,
          currentRound: nextRound,
          champion,
          isComplete,
        },
      };
    }

    case 'SET_PHASE':
      return {
        ...state,
        phase: action.phase,
      };

    case 'RESET':
      clearState();
      return { ...initialState };

    case 'RESTORE_STATE':
      return action.state;

    default:
      return state;
  }
}

// ===== Context =====

interface TournamentContextType {
  state: TournamentState;
  dispatch: Dispatch<TournamentAction>;
  setPerson: (person: Person) => void;
  setFilms: (films: Movie[]) => void;
  startBracket: (films: Movie[]) => void;
  vote: (matchupId: string, winner: Movie) => void;
  goToPhase: (phase: AppPhase) => void;
  reset: () => void;
}

const TournamentContext = createContext<TournamentContextType | null>(null);

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tournamentReducer, initialState);

  // 恢复保存的状态（仅在刷新时，且只在 bracket/results 阶段恢复）
  useEffect(() => {
    const saved = loadState();
    if (saved && (saved.phase === 'bracket' || saved.phase === 'results')) {
      if (saved.bracket && saved.films.length > 0) {
        dispatch({ type: 'RESTORE_STATE', state: saved });
      }
    }
  }, []);

  // 保存状态
  useEffect(() => {
    if (state.phase === 'bracket' || state.phase === 'results') {
      saveState(state);
    }
  }, [state]);

  const actions: TournamentContextType = {
    state,
    dispatch,
    setPerson: (person: Person) => dispatch({ type: 'SET_PERSON', person }),
    setFilms: (films: Movie[]) => dispatch({ type: 'SET_FILMS', films }),
    startBracket: (films: Movie[]) => {
      const count = bracket.selectFilmCount(films.length);
      const selected = films.slice(0, count);
      const bracketState = bracket.buildBracket(selected);
      dispatch({ type: 'START_BRACKET', bracket: bracketState });
    },
    vote: (matchupId: string, winner: Movie) =>
      dispatch({ type: 'VOTE', matchupId, winner }),
    goToPhase: (phase: AppPhase) => dispatch({ type: 'SET_PHASE', phase }),
    reset: () => {
      clearState();
      dispatch({ type: 'RESET' });
    },
  };

  return (
    <TournamentContext.Provider value={actions}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament(): TournamentContextType {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournament must be used within TournamentProvider');
  return ctx;
}
