import { useState } from 'react';
import type { Matchup, Movie } from '../types';
import { getRoundName } from '../utils/bracket';

interface MatchupCardProps {
  matchup: Matchup;
  matchupNumber: number;
  totalMatchups: number;
  totalFilms: number;
  onVote: (matchupId: string, winner: Movie) => void;
}

function FilmSide({
  film,
  side,
  isVoted,
  isWinner,
  onVote,
}: {
  film: Movie | null;
  side: 'A' | 'B';
  isVoted: boolean;
  isWinner: boolean;
  onVote: () => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`flex-1 flex flex-col items-center p-4 rounded-xl transition-all duration-300
        ${isWinner
          ? 'bg-indigo-600/20 border-2 border-indigo-500 scale-105'
          : 'border-2 border-transparent'
        }
        ${isVoted && !isWinner ? 'opacity-40 scale-95' : ''}
        ${!isVoted ? 'cursor-pointer hover:bg-gray-700/40' : ''}`}
      onClick={() => !isVoted && film && onVote()}
    >
      {/* 海报 */}
      <div className="w-28 h-40 sm:w-36 sm:h-52 rounded-lg overflow-hidden bg-gray-700 mb-3 shadow-lg">
        {film?.posterUrl && !imgError ? (
          <img
            src={film.posterUrl}
            alt={film.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3">
            <span className="text-3xl mb-1">🎬</span>
            <span className="text-gray-400 text-xs text-center line-clamp-3">
              {film?.title || '待定'}
            </span>
          </div>
        )}
      </div>

      {/* 影片名 */}
      <h3 className="text-white text-sm sm:text-base font-medium text-center leading-tight line-clamp-2 mb-1">
        {film?.title || '待定'}
      </h3>

      {/* 评分信息 */}
      {film && (
        <div className="text-xs text-gray-500 text-center">
          {film.rating > 0 && (
            <span className="text-amber-400 font-medium">★ {film.rating.toFixed(1)}</span>
          )}
          {film.releaseYear && <span className="ml-1">{film.releaseYear}</span>}
        </div>
      )}

      {/* 投票按钮 */}
      {!isVoted && film && (
        <button
          className="mt-3 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500
                     rounded-full text-white text-sm font-medium
                     transition-all active:scale-95"
        >
          投票
        </button>
      )}

      {/* 胜出标记 */}
      {isWinner && (
        <div className="mt-2 text-2xl animate-bounce">👑</div>
      )}
    </div>
  );
}

export default function MatchupCard({
  matchup,
  matchupNumber,
  totalMatchups,
  totalFilms,
  onVote,
}: MatchupCardProps) {
  const roundName = getRoundName(matchup.roundIndex, totalFilms);
  const isVoted = matchup.winner !== null;

  const handleVote = (film: Movie) => {
    onVote(matchup.id, film);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      {/* 轮次信息 */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white">{roundName}</h2>
        <p className="text-gray-500 text-sm mt-1">
          第 {matchupNumber} / {totalMatchups} 场
        </p>
      </div>

      {/* VS 对决 */}
      <div className="flex items-center gap-2 sm:gap-4">
        <FilmSide
          film={matchup.filmA}
          side="A"
          isVoted={isVoted}
          isWinner={isVoted && matchup.winner?.id === matchup.filmA?.id}
          onVote={() => matchup.filmA && handleVote(matchup.filmA)}
        />

        {/* VS 分割 */}
        <div className="shrink-0 flex flex-col items-center gap-1">
          <span className="text-2xl sm:text-3xl font-black text-red-500">VS</span>
          {isVoted && (
            <span className="text-xs text-gray-500">已投票</span>
          )}
        </div>

        <FilmSide
          film={matchup.filmB}
          side="B"
          isVoted={isVoted}
          isWinner={isVoted && matchup.winner?.id === matchup.filmB?.id}
          onVote={() => matchup.filmB && handleVote(matchup.filmB)}
        />
      </div>

      {/* 轮空提示 */}
      {(!matchup.filmA || !matchup.filmB) && (
        <p className="text-center text-gray-600 text-sm mt-4">
          {matchup.filmA ? matchup.filmA.title : '?'} 本轮轮空，自动晋级
        </p>
      )}
    </div>
  );
}
