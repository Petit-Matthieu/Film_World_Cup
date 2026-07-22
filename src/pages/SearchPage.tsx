import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import PersonCard from '../components/PersonCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { useTournament } from '../context/TournamentContext';
import { searchPerson, searchSuggest } from '../services/douban';
import type { Person } from '../types';

interface SuggestItem {
  title: string; subTitle: string; url: string; type: string; image: string;
}

export default function SearchPage() {
  const { setPerson, state } = useTournament();
  const navigate = useNavigate();

  const [results, setResults] = useState<Person[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestItem[]>([]);
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

  // 回车搜索或点击建议
  const doSearch = useCallback(async (query: string) => {
    setIsLoading(true); setError(''); setHasSearched(true); setSuggestions([]);
    try {
      const { people } = await searchPerson(query);
      setResults(people);
      if (people.length === 0) setError(`未找到"${query}"相关影人，请尝试其他名字`);
    } catch {
      setError('搜索失败，请检查网络连接');
    }
    setIsLoading(false);
  }, []);

  // 点击下拉建议
  const handleSelectSuggestion = useCallback(async (item: SuggestItem) => {
    const id = item.url.replace('person:', '');
    const name = item.title;
    // 用影人名搜索获取电影
    setPerson({ id, name, department: '影人', avatarUrl: null });
    navigate('/select');
  }, [setPerson, navigate]);

  // 点击结果卡片
  const handlePersonClick = useCallback((person: Person) => {
    setPerson(person);
    navigate('/select');
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
            王家卫 · 梁朝伟 · 克里斯托弗·诺兰 · 巩俐 · 周星驰 · 姜文
          </div>
        </div>
      )}

      <div className={`px-4 ${hasSearched ? 'pt-4' : ''}`}>
        <SearchBar
          onSearch={doSearch}
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
        {!isLoading && results.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 mb-3">找到 {results.length} 位影人</p>
            {results.map((p) => (
              <PersonCard key={p.id} person={p} onClick={handlePersonClick} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
