import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import PersonCard from '../components/PersonCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { useTournament } from '../context/TournamentContext';
import { searchPerson, searchSuggest, getDirectorsFromMovie } from '../services/douban';
import type { Person } from '../types';

interface SuggestItem {
  title: string;
  subTitle: string;
  url: string;
  type: string;
  image: string;
}

export default function SearchPage() {
  const { setPerson, state } = useTournament();
  const navigate = useNavigate();

  const [results, setResults] = useState<Person[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false); // 联想请求中
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 实时联想
  const handleInputChange = useCallback((query: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const items = await searchSuggest(query.trim());
        setSuggestions(items);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  // 从联想中选择影人
  const handleSelectSuggestion = useCallback(
    async (item: SuggestItem) => {
      setIsLoading(true);
      setError('');
      setHasSearched(true);

      try {
        // 影人：直接从 URL 提取 ID
        const cMatch = item.url?.match(/(?:celebrity|personage)\/(\d+)/);
        if (cMatch) {
          setPerson({
            id: cMatch[1],
            name: item.title,
            department: item.subTitle || '影人',
            avatarUrl: null,
          });
          navigate('/select');
          return;
        }

        // 电影：从电影页提取导演
        const mId = item.url?.match(/subject\/(\d+)/)?.[1];
        if (mId) {
          const people = await getDirectorsFromMovie(mId);
          if (people.length > 0) {
            setResults(people);
            return;
          }
        }

        // 兜底搜索
        const people = await searchPerson(item.title);
        if (people.length > 0) {
          setResults(people);
        } else {
          setError(`未找到"${item.title}"相关影人`);
        }
      } catch (err) {
        console.error('失败:', err);
        setError('获取影人信息失败，请重试');
      } finally {
        setIsLoading(false);
      }
    },
    [setPerson, navigate]
  );

  // 传统搜索（回车触发）
  const handleSearch = useCallback(async (query: string) => {
    setIsLoading(true);
    setError('');
    setHasSearched(true);
    setSuggestions([]);

    try {
      const people = await searchPerson(query);
      setResults(people);

      if (people.length === 0) {
        setError(`未找到"${query}"相关影人，请尝试其他名字`);
      }
    } catch (err) {
      console.error('搜索失败:', err);
      setError('搜索失败，请检查网络连接后重试');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelectPerson = useCallback(
    (person: Person) => {
      setPerson(person);
      navigate('/select');
    },
    [setPerson, navigate]
  );

  return (
    <div className="min-h-screen">
      {/* 欢迎区 */}
      {!hasSearched && (
        <div className="text-center pt-16 pb-8 px-4">
          <div className="text-6xl mb-6">🏆🎬</div>
          <h2 className="text-3xl font-bold text-white mb-3">电影世界杯</h2>
          <p className="text-gray-400 text-lg max-w-md mx-auto">
            搜索一位导演或演员，用 Ta 的经典电影来一场单败淘汰赛！
          </p>
          <div className="flex justify-center gap-4 mt-6 text-sm text-gray-600 flex-wrap">
            <span>王家卫</span> · <span>梁朝伟</span> · <span>诺兰</span>
            <span>·</span> <span>巩俐</span> · <span>周星驰</span>
            <span>·</span> <span>姜文</span>
          </div>
        </div>
      )}

      {/* 搜索栏 */}
      <div className={`px-4 ${hasSearched ? 'pt-4' : ''}`}>
        <SearchBar
          onSearch={handleSearch}
          onSelectSuggestion={handleSelectSuggestion}
          suggestions={suggestions}
          isLoading={isLoading}
          isSearching={isSearching}
          onInputChange={handleInputChange}
        />
      </div>

      {/* 状态 */}
      <div className="max-w-lg mx-auto px-4 mt-6">
        {isLoading && <LoadingSpinner message="正在搜索豆瓣..." size="md" />}

        {error && !isLoading && (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-gray-400">{error}</p>
          </div>
        )}

        {/* 搜索结果 */}
        {!isLoading && results.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 mb-3">
              找到 {results.length} 位影人
            </p>
            {results.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                onClick={handleSelectPerson}
              />
            ))}
          </div>
        )}

        {/* 恢复之前的状态 */}
        {!hasSearched && !isLoading && state.person && state.phase === 'selection' && (
          <div className="text-center mt-8 p-4 bg-gray-800/40 rounded-xl">
            <p className="text-gray-400 text-sm mb-3">
              上次搜索：{state.person.name}
            </p>
            <button
              onClick={() => navigate('/select')}
              className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
            >
              继续上次的选择 →
            </button>
          </div>
        )}

        {!hasSearched && !isLoading && state.bracket && !state.bracket.isComplete && (
          <div className="text-center mt-4 p-4 bg-gray-800/40 rounded-xl">
            <p className="text-gray-400 text-sm mb-3">有未完成的比赛</p>
            <button
              onClick={() => navigate('/bracket')}
              className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
            >
              继续投票 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
