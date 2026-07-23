import type { BracketState, Matchup, Movie } from '../types';
import { getRoundName } from '../utils/bracket';

interface BracketViewProps {
  bracket: BracketState;
}

function MiniFilm({ film, isWinner }: { film: Movie | null; isWinner?: boolean }) {
  if (!film) {
    return (
      <div className="text-gray-600 text-xs italic p-1">待定</div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 p-1.5 rounded min-w-0
        ${isWinner ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-gray-800/50'}`}
      title={`${film.title} ★${film.rating.toFixed(1)}`}
    >
      <div className="w-8 h-10 rounded overflow-hidden bg-gray-700 shrink-0">
        {film.posterUrl ? (
          <img
            src={film.posterUrl}
            alt={film.title}
            className="w-full h-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs">🎬</div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-white font-medium truncate">{film.title}</p>
        <p className="text-xs text-amber-400">★ {film.rating.toFixed(1)}</p>
      </div>
      {isWinner && <span className="text-sm shrink-0">👑</span>}
    </div>
  );
}

export default function BracketView({ bracket }: BracketViewProps) {
  const totalFilms = bracket.films.length;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-fit px-4" style={{ minWidth: `${bracket.matchups.length * 200}px` }}>
        {bracket.matchups.map((round, roundIdx) => {
          const matchupHeight = 70 * Math.pow(2, roundIdx); // 每个对阵的高度按2倍增长
          const roundName = getRoundName(roundIdx, totalFilms);

          return (
            <div
              key={roundIdx}
              className="flex flex-col shrink-0"
              style={{ width: '180px' }}
            >
              {/* 轮次标题 */}
              <div className="text-center mb-3 sticky top-0 bg-gray-950 py-2 z-10">
                <h3 className="text-sm font-bold text-indigo-400">{roundName}</h3>
                <p className="text-xs text-gray-600">{round.length} 场</p>
              </div>

              {/* 对阵列表 */}
              <div className="flex flex-col gap-2">
                {round.map((matchup, posIdx) => (
                  <div
                    key={matchup.id}
                    className="border border-gray-700/50 rounded-lg p-2 bg-gray-900/50"
                    style={{ marginTop: posIdx > 0 ? matchupHeight - 70 : 0 }}
                  >
                    <MiniFilm
                      film={matchup.filmA}
                      isWinner={
                        matchup.winner !== null &&
                        matchup.filmA?.id === matchup.winner.id
                      }
                    />
                    <div className="text-center text-[10px] text-gray-600 my-0.5">
                      VS
                    </div>
                    <MiniFilm
                      film={matchup.filmB}
                      isWinner={
                        matchup.winner !== null &&
                        matchup.filmB?.id === matchup.winner.id
                      }
                    />
                    {/* 比分/结果 */}
                    {matchup.winner && (
                      <div className="text-center text-[10px] text-green-500 mt-1">
                        胜: {matchup.winner.title}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
