import { useTournament } from '../context/TournamentContext';
import { APP_TITLE, APP_SUBTITLE } from '../constants';

export default function Header() {
  const { state, reset } = useTournament();

  return (
    <header className="w-full bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <button
          onClick={reset}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          title="重新开始"
        >
          <span className="text-2xl">🏆</span>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">{APP_TITLE}</h1>
            <p className="text-xs text-gray-500 leading-tight">{APP_SUBTITLE}</p>
          </div>
        </button>

        {state.person && state.phase !== 'search' && (
          <div className="text-right">
            <p className="text-sm text-gray-400">
              {state.person.name}
            </p>
            <p className="text-xs text-gray-600">{state.person.department}</p>
          </div>
        )}
      </div>

      {/* 进度条 */}
      {state.bracket && !state.bracket.isComplete && (
        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-indigo-500 transition-all duration-500"
            style={{
              width: `${
                ((state.bracket.currentRound) /
                  state.bracket.matchups.length) *
                100
              }%`,
            }}
          />
        </div>
      )}
    </header>
  );
}
