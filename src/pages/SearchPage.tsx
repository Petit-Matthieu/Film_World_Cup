import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import PersonCard from '../components/PersonCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { useTournament } from '../context/TournamentContext';
import { searchPerson, searchSuggest, getDirectorsFromMovie } from '../services/douban';
import type { Person } from '../types';

interface SuggestItem {
  title: string; subTitle: string; url: string; type: string; image: string;
}

export default function SearchPage() {
  const { setPerson, state } = useTournament();
  const navigate = useNavigate();

  const [results, setResults] = useState<Person[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestItem[]>([]);
  const [movieSuggestions, setMovieSuggestions] = useState<SuggestItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // 实时联想
  const handleInputChange = useCallback((query: string) => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setSuggestions([]); return; }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const items = await searchSuggest(query.trim());
        setSuggestions(items);
      } catch { setSuggestions([]); }
      finally { setIsSearching(false); }
    }, 300);
  }, []);

  // 点击联想项
  const handleSelectSuggestion = useCallback(async (item: SuggestItem) => {
    setIsLoading(true); setError(''); setHasSearched(true); setSuggestions([]);

    // 影人：直接用
    const cMatch = item.url?.match(/(?:celebrity|personage)\/(\d+)/);
    if (cMatch) {
      const p: Person = { id: cMatch[1], name: item.title, department: item.subTitle || '影人', avatarUrl: null };
      setPerson(p);
      navigate('/select');
      setIsLoading(false);
      return;
    }

    // 电影：提取导演
    const mId = item.url?.match(/subject\/(\d+)/)?.[1];
    if (mId) {
      try {
        const directors = await getDirectorsFromMovie(mId);
        if (directors.length > 0) { setResults(directors); setIsLoading(false); return; }
      } catch {}
    }

    setError(`未能从"${item.title}"提取影人信息`);
    setIsLoading(false);
  }, [setPerson, navigate]);

  // 回车搜索
  const handleSearch = useCallback(async (query: string) => {
    setIsLoading(true); setError(''); setHasSearched(true); setSuggestions([]);
    try {
      const people = await searchPerson(query);
      if (people.length > 0) {
        setResults(people);
        setMovieSuggestions([]);
      } else {
        // 没找到影人，把 suggest 结果中的电影展示出来让用户点
        const movies = await searchSuggest(query);
        const onlyMovies = movies.filter((m) => m.url.includes('/subject/'));
        setMovieSuggestions(onlyMovies);
        setResults([]);
        if (onlyMovies.length === 0) setError(`未找到"${query}"相关影人，请尝试其他名字`);
      }
    } catch {
      setError('搜索失败，请检查网络');
      setResults([]);
    }
    finally { setIsLoading(false); }
  }, []);

  // 点击电影卡片提取导演
  const handleMovieClick = useCallback(async (item: SuggestItem) => {
    setIsLoading(true); setError('');
    const mId = item.url?.match(/subject\/(\d+)/)?.[1];
    if (!mId) { setError('无效的电影链接'); setIsLoading(false); return; }
    try {
      const directors = await getDirectorsFromMovie(mId);
      if (directors.length > 0) {
        setMovieSuggestions([]);
        setResults(directors);
      } else {
        setError(`未能从"${item.title}"提取影人信息`);
      }
    } catch { setError('提取失败，请重试'); }
    setIsLoading(false);
  }, []);

  const handlePersonClick = useCallback((person: Person) => {
    setPerson(person); navigate('/select');
  }, [setPerson, navigate]);

  return (
    <div className="min-h-screen">
      {!hasSearched && (
        <div className="text-center pt-16 pb-8 px-4">
          <div className="text-6xl mb-6">🏆🎬</div>
          <h2 className="text-3xl font-bold text-white mb-3">电影世界杯</h2>
          <p className="text-gray-400 text-lg max-w-md mx-auto">
            搜索导演或演员，用 Ta 的电影来一场淘汰赛！
          </p>
          <div className="flex justify-center gap-4 mt-6 text-sm text-gray-600 flex-wrap">
            王家卫 · 梁朝伟 · 诺兰 · 巩俐 · 周星驰 · 姜文
          </div>
        </div>
      )}

      <div className={`px-4 ${hasSearched ? 'pt-4' : ''}`}>
        <SearchBar
          onSearch={handleSearch}
          onSelectSuggestion={handleSelectSuggestion}
          suggestions={suggestions} isLoading={isLoading}
          isSearching={isSearching} onInputChange={handleInputChange}
        />
      </div>

      <div className="max-w-lg mx-auto px-4 mt-6">
        {isLoading && <LoadingSpinner message="搜索中..." />}

        {error && !isLoading && (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-gray-400">{error}</p>
          </div>
        )}

        {/* 影人结果 */}
        {!isLoading && results.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 mb-3">找到 {results.length} 位影人</p>
            {results.map((p) => (
              <PersonCard key={p.id} person={p} onClick={handlePersonClick} />
            ))}
          </div>
        )}

        {/* 电影建议（没找到影人时显示） */}
        {!isLoading && movieSuggestions.length > 0 && results.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-400 mb-3">
              未直接找到影人，点击电影提取导演：
            </p>
            {movieSuggestions.map((item) => (
              <button
                key={item.url}
                onClick={() => handleMovieClick(item)}
                className="w-full flex items-center gap-3 p-3 bg-gray-800/60 hover:bg-gray-700/60
                           border border-gray-700/50 rounded-xl transition-all text-left"
              >
                <div className="w-10 h-14 bg-gray-700 rounded overflow-hidden shrink-0">
                  {item.image ? (
                    <img src={item.image} alt="" className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : <div className="w-full h-full flex items-center justify-center">🎬</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{item.title}</p>
                  <p className="text-gray-500 text-xs">点击查看导演/演员 →</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 恢复状态按钮 */}
        {!hasSearched && !isLoading && state.person && (
          <div className="text-center mt-8 p-4 bg-gray-800/40 rounded-xl">
            <p className="text-gray-400 text-sm mb-3">上次搜索：{state.person.name}</p>
            <button onClick={() => navigate('/select')} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">
              继续上次的选择 →
            </button>
          </div>
        )}
        {!hasSearched && !isLoading && state.bracket && !state.bracket.isComplete && (
          <div className="text-center mt-4 p-4 bg-gray-800/40 rounded-xl">
            <p className="text-gray-400 text-sm mb-3">有未完成的比赛</p>
            <button onClick={() => navigate('/bracket')} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">
              继续投票 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
