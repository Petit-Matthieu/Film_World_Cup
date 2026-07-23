import { useState, useEffect, useRef, type FormEvent } from 'react';

interface SuggestItem {
  title: string;
  subTitle: string;
  url: string;
  type: string;
  image: string;
}

interface SearchBarProps {
  onSearch: (query: string) => void;
  onSelectSuggestion?: (item: SuggestItem) => void;
  suggestions: SuggestItem[];
  isLoading: boolean;
  isSearching: boolean;
  onInputChange: (query: string) => void;
}

export default function SearchBar({
  onSearch,
  onSelectSuggestion,
  suggestions,
  isLoading,
  isSearching,
  onInputChange,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);

  // 通知父组件
  const doNotify = (value: string) => {
    setQuery(value);
    setSelectedIndex(-1);
    if (value.trim()) {
      setShowSuggestions(true);
      onInputChange(value);
    } else {
      setShowSuggestions(false);
      onInputChange('');
    }
  };

  const handleChange = () => {
    // IME 组合中跳过，等 compositionEnd 统一处理
    if (composingRef.current) return;
    const value = inputRef.current?.value || '';
    doNotify(value);
  };

  const handleCompositionStart = () => {
    composingRef.current = true;
  };

  const handleCompositionEnd = () => {
    composingRef.current = false;
    // 主动触发一次同步
    const value = inputRef.current?.value || '';
    doNotify(value);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed && !isLoading) {
      setShowSuggestions(false);
      onSearch(trimmed);
    }
  };

  const handleSelect = (item: SuggestItem) => {
    setQuery(item.title);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    if (onSelectSuggestion) {
      onSelectSuggestion(item);
    } else {
      onSearch(item.title);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  // 点击外部关闭下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showDropdown = showSuggestions && suggestions.length > 0;

  return (
    <div className="w-full max-w-lg mx-auto relative">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            placeholder="搜索导演或演员，如：王家卫、梁朝伟..."
            className="w-full px-5 py-4 pr-14 bg-gray-800/80 border border-gray-700 rounded-xl
                       text-white placeholder-gray-500
                       focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30
                       transition-all text-lg"
            disabled={isLoading || isSearching}
            autoFocus
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={isLoading || isSearching || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2
                       p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500
                       disabled:bg-gray-700 disabled:opacity-50
                       transition-all text-white"
          >
            {isLoading || isSearching ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </button>
        </div>
      </form>

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700
                     rounded-xl overflow-hidden shadow-2xl shadow-black/50 z-50"
        >
          {suggestions.map((item, idx) => (
            <button
              key={`${item.type}-${item.url}`}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                ${idx === selectedIndex
                  ? 'bg-indigo-600/30 border-l-2 border-indigo-400'
                  : 'hover:bg-gray-700/50 border-l-2 border-transparent'}`}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden shrink-0">
                {item.image ? (
                  <img src={item.image} alt="" className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">
                    {item.type === 'person' || item.type === 'celebrity' || item.type === 'celebrities' ? '👤' : '🎬'}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{item.title}</p>
                <p className="text-gray-500 text-xs truncate">{item.subTitle}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0
                ${(item.type === 'person' || item.type === 'celebrity' || item.type === 'celebrities')
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-blue-500/20 text-blue-400'}`}>
                {(item.type === 'person' || item.type === 'celebrity' || item.type === 'celebrities') ? '影人' : '电影'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
