import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../context/TournamentContext';
import { getPersonFilms } from '../services/douban';
import SelectionGrid from '../components/SelectionGrid';
import LoadingSpinner from '../components/LoadingSpinner';
import { selectFilmCount } from '../utils/bracket';
import { MIN_FILMS } from '../constants';
import type { Movie } from '../types';

export default function SelectionPage() {
  const { state, setFilms, startBracket } = useTournament();
  const navigate = useNavigate();

  const [allFilms, setAllFilms] = useState<Movie[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { if (!state.person) navigate('/'); }, [state.person, navigate]);

  useEffect(() => {
    if (!state.person) return;
    if (state.films.length > 0 && state.phase === 'selection') {
      setAllFilms(state.films);
      setIsLoading(false);
      const target = selectFilmCount(state.films.length);
      setSelectedIds(new Set(state.films.slice(0, target).map((f) => f.id)));
      return;
    }

    let cancelled = false;
    (async () => {
      setIsLoading(true); setError('');
      try {
        const films = await getPersonFilms(state.person!.name);
        if (cancelled) return;
        if (films.length < MIN_FILMS) {
          setAllFilms(films);
          setError(`只找到 ${films.length} 部作品，至少需要 ${MIN_FILMS} 部`);
        } else {
          setAllFilms(films);
          const target = selectFilmCount(films.length);
          setSelectedIds(new Set(films.slice(0, target).map((f) => f.id)));
        }
      } catch (e: any) {
        if (!cancelled) setError(`加载失败：${e.message}`);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [state.person, state.films, state.phase]);

  const handleToggle = useCallback((movie: Movie) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const target = selectFilmCount(allFilms.length);
      if (next.has(movie.id)) { next.delete(movie.id); }
      else if (next.size < target) { next.add(movie.id); }
      return next;
    });
  }, [allFilms]);

  const handleConfirm = useCallback(() => {
    const selected = allFilms.filter((f) => selectedIds.has(f.id));
    // 先保存选中的电影
    setFilms(selected);
    // 直接传入选中的电影，避免 startBracket 读取到旧的 state.films
    startBracket(selected);
    navigate('/bracket');
  }, [allFilms, selectedIds, setFilms, startBracket, navigate]);

  if (!state.person) return null;

  return (
    <div className="min-h-screen">
      <div className="text-center pt-6 pb-2 px-4">
        <h2 className="text-2xl font-bold text-white">{state.person.name}</h2>
        <p className="text-gray-500 text-sm mt-1">选择电影参与世界杯 (按豆瓣评分排序)</p>
      </div>

      {isLoading ? (
        <div className="py-12"><LoadingSpinner message="正在加载作品..." size="lg" /></div>
      ) : error && allFilms.length === 0 ? (
        <div className="text-center py-12 px-4">
          <p className="text-5xl mb-4">😢</p>
          <p className="text-gray-400 text-lg">{error}</p>
          <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white">返回重新搜索</button>
        </div>
      ) : (
        <SelectionGrid films={allFilms} selectedIds={selectedIds} onToggle={handleToggle} onConfirm={handleConfirm} />
      )}
    </div>
  );
}
