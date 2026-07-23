import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../context/TournamentContext';
import MatchupCard from '../components/MatchupCard';
import { getRoundName, getTotalRounds } from '../utils/bracket';
import { ROUND_NAMES_32, ROUND_NAMES_16, ROUND_NAMES_8 } from '../constants';
import type { Movie } from '../types';

export default function BracketPage() {
  const { state, vote } = useTournament();
  const navigate = useNavigate();
  const [matchupIndex, setMatchupIndex] = useState(0);
  const [votedCount, setVotedCount] = useState(0);

  // 守卫：没有 bracket 或 films 则返回首页
  useEffect(() => {
    if (!state.bracket || state.films.length === 0) {
      navigate('/', { replace: true });
    }
  }, [state.bracket, state.films, navigate]);

  // 结果页跳转
  useEffect(() => {
    if (state.bracket?.isComplete) {
      navigate('/results', { replace: true });
    }
  }, [state.bracket?.isComplete, navigate]);

  if (!state.bracket) return null;

  const { bracket } = state;
  const totalFilms = bracket.films.length;
  const totalRounds = getTotalRounds(totalFilms);
  const roundNames = totalFilms === 32 ? ROUND_NAMES_32 : totalFilms === 16 ? ROUND_NAMES_16 : ROUND_NAMES_8;
  const currentRound = bracket.currentRound;
  const currentMatchups = bracket.matchups[currentRound] || [];
  const totalMatchups = currentMatchups.length;

  // 计算本轮已投票数量
  const roundVotedCount = currentMatchups.filter((m) => m.winner !== null).length;

  // 切换轮次时重置
  useEffect(() => {
    setMatchupIndex(0);
    setVotedCount(0);
  }, [currentRound]);

  const handleVote = useCallback((matchupId: string, winner: Movie) => {
    vote(matchupId, winner);
    // 立即跳到下一场
    const matchups = bracket.matchups[currentRound];
    const currentIdx = matchups.findIndex((m) => m.id === matchupId);
    const nextIdx = currentIdx + 1;
    let nextUnvoted = nextIdx;
    while (nextUnvoted < matchups.length && matchups[nextUnvoted].winner !== null) {
      nextUnvoted++;
    }
    if (nextUnvoted < matchups.length) {
      setMatchupIndex(nextUnvoted);
    }
    setVotedCount((c) => c + 1);
  }, [bracket.matchups, currentRound, vote]);

  const currentMatchup = currentMatchups[matchupIndex];

  // 本轮已经全部投票完成
  const roundComplete = roundVotedCount >= totalMatchups;

  return (
    <div className="min-h-screen pb-8">
      {/* 轮次指示器 */}
      <div className="text-center pt-6 pb-2 px-4">
        <p className="text-sm text-gray-500 mb-1">
          {state.person?.name} · {totalFilms} 部电影
        </p>
        <h2 className="text-2xl font-bold text-white">
          {roundNames[currentRound] || `第${currentRound + 1}轮`}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {roundComplete
            ? '本轮投票已完成'
            : `第 ${matchupIndex + 1} / ${totalMatchups} 场对决`}
        </p>

        {/* 进度条 */}
        <div className="max-w-md mx-auto mt-3 bg-gray-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${totalMatchups > 0 ? (roundVotedCount / totalMatchups) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* VS 对决区域 */}
      <div className="mt-6">
        {currentMatchup && !roundComplete ? (
          <MatchupCard
            key={currentMatchup.id}
            matchup={currentMatchup}
            matchupNumber={matchupIndex + 1}
            totalMatchups={totalMatchups}
            totalFilms={totalFilms}
            onVote={handleVote}
          />
        ) : roundComplete ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🎉</div>
            <p className="text-xl text-green-400 font-medium">
              {roundNames[Math.min(currentRound, roundNames.length - 1)]} 已完成！
            </p>
            <p className="text-gray-400 mt-2">
              {currentRound + 1 < totalRounds
                ? `即将进入 ${roundNames[currentRound + 1]}`
                : '即将揭晓冠军！'}
            </p>
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-500">等待对决开始...</p>
          </div>
        )}
      </div>

      {/* 底部信息栏 */}
      <div className="text-center mt-8 space-y-3">
        {/* 轮次概览 */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap px-4">
          {roundNames.map((name, i) => (
            <span
              key={i}
              className={`text-xs px-2 py-0.5 rounded-full transition-all
                ${i < currentRound ? 'bg-green-600/20 text-green-400' : ''}
                ${i === currentRound ? 'bg-indigo-600/30 text-indigo-300 ring-1 ring-indigo-500' : ''}
                ${i > currentRound ? 'bg-gray-800 text-gray-600' : ''}`}
            >
              {name}
            </span>
          ))}
        </div>

        <button
          onClick={() => navigate('/')}
          className="text-sm text-gray-600 hover:text-gray-400 transition-colors"
        >
          放弃比赛，重新开始
        </button>
      </div>
    </div>
  );
}
