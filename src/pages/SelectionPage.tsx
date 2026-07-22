import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../context/TournamentContext';
import { getPersonFilms } from '../services/douban';
import SelectionGrid from '../components/SelectionGrid';
import LoadingSpinner from '../components/LoadingSpinner';
import { selectFilmCount, seedFilms } from '../utils/bracket';
import { MIN_FILMS } from '../constants';
import type { Movie } from '../types';

export default function SelectionPage() {
  const { state, setFilms, startBracket } = useTournament();
  const navigate = useNavigate();

  const [allFilms, setAllFilms] = useState<Movie[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // 没有影人就回首页
  useEffect(() => {
    if (!state.person) {
      navigate('/');
    }
  }, [state.person, navigate]);

  // 加载电影
  useEffect(() => {
    if (!state.person) return;

    // 如果已有电影列表（从 localStorage 恢复），直接使用
    if (state.films.length > 0 && state.phase === 'selection') {
      setAllFilms(state.films);
      setIsLoading(false);
      const target = selectFilmCount(state.films.length);
      const ids = new Set(state.films.slice(0, target).map((f) => f.id));
      setSelectedIds(ids);
      return;
    }

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError('');

      try {
        const films = await getPersonFilms(state.person!.id);

        if (cancelled) return;

        if (films.length < MIN_FILMS) {
          setAllFilms(films);
          setError(`该影人只有 ${films.length} 部作品，至少需要 ${MIN_FILMS} 部`);
        } else {
          setAllFilms(films);
          const target = selectFilmCount(films.length);
          const ids = new Set(films.slice(0, target).map((f) => f.id));
          setSelectedIds(ids);
        }
      } catch (err) {
        console.error('加载电影失败:', err);
        if (!cancelled) {
          setError('加载电影列表失败，请检查网络后重试');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.person, state.films, state.phase]);

  const handleToggle = useCallback(
    (movie: Movie) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        const target = selectFilmCount(allFilms.length);
        if (next.has(movie.id)) {
          next.delete(movie.id);
        } else {
          if (next.size >= target) {
            return prev; // 已达上限
          }
          next.add(movie.id);
        }
        return next;
      });
    },
    [allFilms]
  );

  const handleConfirm = useCallback(() => {
    const selected = allFilms
      .filter((f) => selectedIds.has(f.id));
    setFilms(selected);
    startBracket();
    navigate('/bracket');
  }, [allFilms, selectedIds, setFilms, startBracket, navigate]);

  if (!state.person) return null;

  return (
    <div className="min-h-screen">
      {/* 影人信息 */}
      <div className="text-center pt-6 pb-2 px-4">
        <h2 className="text-2xl font-bold text-white">
          {state.person.name}
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          选择电影参与世界杯 (按豆瓣评分排序)
        </p>
      </div>

      {isLoading ? (
        <div className="py-12">
          <LoadingSpinner message={`正在加载 ${state.person.name} 的作品...`} size="lg" />
        </div>
      ) : error && allFilms.length === 0 ? (
        <div className="text-center py-12 px-4">
          <p className="text-5xl mb-4">😢</p>
          <p className="text-gray-400 text-lg">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600
                       rounded-lg text-white transition-all"
          >
            返回重新搜索
          </button>
        </div>
      ) : (
        <SelectionGrid
          films={allFilms}
          selectedIds={selectedIds}
          onToggle={handleToggle}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
