interface RoundIndicatorProps {
  currentRound: number;
  totalRounds: number;
  roundNames: string[];
}

export default function RoundIndicator({
  currentRound,
  totalRounds,
  roundNames,
}: RoundIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-4 px-4 overflow-x-auto">
      {Array.from({ length: totalRounds }, (_, i) => {
        const isDone = i < currentRound;
        const isCurrent = i === currentRound;
        const isFuture = i > currentRound;

        return (
          <div key={i} className="flex items-center gap-2 shrink-0">
            {/* 圆点 + 标签 */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                ${isDone ? 'bg-green-600/20 text-green-400' : ''}
                ${isCurrent ? 'bg-indigo-600/30 text-indigo-300 ring-1 ring-indigo-500' : ''}
                ${isFuture ? 'bg-gray-800 text-gray-600' : ''}`}
            >
              <span
                className={`w-2 h-2 rounded-full
                  ${isDone ? 'bg-green-400' : ''}
                  ${isCurrent ? 'bg-indigo-400 animate-pulse' : ''}
                  ${isFuture ? 'bg-gray-600' : ''}`}
              />
              {roundNames[i]}
            </div>

            {/* 连接线 */}
            {i < totalRounds - 1 && (
              <div
                className={`w-4 h-0.5 shrink-0
                  ${i < currentRound ? 'bg-green-500/50' : 'bg-gray-700'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
