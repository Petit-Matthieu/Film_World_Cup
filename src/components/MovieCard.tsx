import type { Movie } from '../types';

interface MovieCardProps {
  movie: Movie;
  selected?: boolean;
  onToggle?: (movie: Movie) => void;
  showRating?: boolean;
  index?: number;
}

export default function MovieCard({
  movie,
  selected = false,
  onToggle,
  showRating = true,
  index,
}: MovieCardProps) {
  return (
    <button
      onClick={() => onToggle?.(movie)}
      disabled={!onToggle}
      className={`relative w-full rounded-lg overflow-hidden border-2 transition-all
        ${selected
          ? 'border-indigo-500 shadow-lg shadow-indigo-500/20 scale-[1.02]'
          : 'border-gray-700/50 hover:border-gray-600 hover:scale-[1.01]'
        }
        ${!onToggle ? 'cursor-default' : 'cursor-pointer'}
        bg-gray-800/60 group`}
    >
      {/* 排名角标 */}
      {index !== undefined && (
        <div className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-black/70
                        flex items-center justify-center text-xs font-bold
                        border border-gray-600 text-gray-300">
          {index + 1}
        </div>
      )}

      {/* 已选中的勾 */}
      {selected && (
        <div className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-indigo-500
                        flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* 海报 */}
      <div className="aspect-[2/3] bg-gray-700 relative overflow-hidden">
        {movie.posterUrl ? (
          <img
            src={movie.posterUrl}
            alt={movie.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : null}
        <div className={`absolute inset-0 flex flex-col items-center justify-center p-2
          ${movie.posterUrl ? 'hidden' : ''}`}>
          <span className="text-3xl mb-2">🎬</span>
          <span className="text-gray-400 text-xs text-center leading-tight line-clamp-3">
            {movie.title}
          </span>
        </div>
      </div>

      {/* 信息 */}
      <div className="p-2.5">
        <h4 className="text-white text-sm font-medium leading-tight line-clamp-1 mb-0.5">
          {movie.title}
        </h4>
        {movie.titleEn && (
          <p className="text-gray-500 text-xs leading-tight line-clamp-1 mb-1">
            {movie.titleEn}
          </p>
        )}
        {showRating && (
          <div className="flex items-center gap-2 text-xs">
            {movie.rating > 0 ? (
              <span className="text-amber-400 font-semibold">
                ★ {movie.rating.toFixed(1)}
              </span>
            ) : null}
            {movie.releaseYear && (
              <span className="text-gray-500">{movie.releaseYear}</span>
            )}
            {movie.voteCount > 0 && (
              <span className="text-gray-600">
                {movie.voteCount > 10000
                  ? `${(movie.voteCount / 10000).toFixed(1)}万`
                  : movie.voteCount}
                人
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
