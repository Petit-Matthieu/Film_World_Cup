import { useMemo } from 'react';
import type { Movie } from '../types';
import MovieCard from './MovieCard';
import { MAX_FILMS, MIN_FILMS } from '../constants';
import { selectFilmCount } from '../utils/bracket';

interface SelectionGridProps {
  films: Movie[];
  selectedIds: Set<string>;
  onToggle: (movie: Movie) => void;
  onConfirm: () => void;
}

export default function SelectionGrid({
  films,
  selectedIds,
  onToggle,
  onConfirm,
}: SelectionGridProps) {
  const targetCount = useMemo(() => selectFilmCount(films.length), [films.length]);
  const selectedCount = selectedIds.size;
  const canStart = selectedCount >= MIN_FILMS && selectedCount <= MAX_FILMS;

  return (
    <div>
      {/* 状态栏 */}
      <div className="sticky top-16 z-40 bg-gray-950/90 backdrop-blur-sm py-3 mb-4 border-b border-gray-800">
        <div className="flex items-center justify-between max-w-6xl mx-auto px-4">
          <div>
            <p className="text-white font-medium">
              已选 <span className="text-indigo-400">{selectedCount}</span> / {targetCount} 部
            </p>
            {films.length < MIN_FILMS && (
              <p className="text-red-400 text-sm mt-1">
                只有 {films.length} 部作品，至少需要 {MIN_FILMS} 部
              </p>
            )}
            {films.length >= MIN_FILMS && films.length < MAX_FILMS && (
              <p className="text-amber-400 text-sm mt-1">
                共 {films.length} 部作品，使用 {targetCount} 部进行比赛
              </p>
            )}
          </div>
          <button
            onClick={onConfirm}
            disabled={!canStart}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500
                       disabled:bg-gray-700 disabled:opacity-50
                       rounded-lg font-medium text-white transition-all
                       disabled:cursor-not-allowed"
          >
            {films.length < MIN_FILMS
              ? '电影不足'
              : `生成对阵图 (${targetCount}强)`}
          </button>
        </div>
      </div>

      {/* 电影网格 */}
      {films.length < MIN_FILMS ? (
        <div className="text-center py-12">
          <p className="text-5xl mb-4">😞</p>
          <p className="text-gray-400 text-lg">
            该影人只有 {films.length} 部作品
          </p>
          <p className="text-gray-500 mt-2">
            至少需要 {MIN_FILMS} 部电影才能开始比赛
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 px-4 pb-8 max-w-6xl mx-auto">
          {films.map((movie, i) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              selected={selectedIds.has(movie.id)}
              onToggle={onToggle}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}
