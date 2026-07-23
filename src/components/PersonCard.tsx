import type { Person } from '../types';

interface PersonCardProps {
  person: Person;
  onClick: (person: Person) => void;
  rank?: number;
}

export default function PersonCard({ person, onClick, rank }: PersonCardProps) {
  return (
    <button
      onClick={() => onClick(person)}
      className="w-full flex items-center gap-4 p-4 bg-gray-800/60 hover:bg-gray-700/60
                 border border-gray-700/50 hover:border-indigo-500/50
                 rounded-xl transition-all text-left group"
    >
      {rank !== undefined && (
        <span className="text-xs text-gray-600 font-mono w-6 shrink-0">
          {rank}
        </span>
      )}

      {/* 头像 */}
      <div className="w-14 h-14 rounded-full bg-gray-700 overflow-hidden shrink-0">
        {person.avatarUrl ? (
          <img
            src={person.avatarUrl}
            alt={person.name}
            className="w-full h-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              // wsrv.nl 代理失败时尝试直连
              if (img.src.includes('wsrv.nl')) {
                const match = img.src.match(/url=([^&]+)/);
                if (match) {
                  img.src = decodeURIComponent(match[1]);
                  return;
                }
              }
              img.style.display = 'none';
              img.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`w-full h-full flex items-center justify-center text-xl font-bold text-gray-500 ${person.avatarUrl ? 'hidden' : ''}`}>
          {person.name.charAt(0)}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-white font-medium group-hover:text-indigo-400 transition-colors truncate">
          {person.name}
        </h3>
        {person.department && (
          <p className="text-sm text-gray-500 mt-0.5">{person.department}</p>
        )}
      </div>

      <svg className="w-5 h-5 text-gray-600 group-hover:text-indigo-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
