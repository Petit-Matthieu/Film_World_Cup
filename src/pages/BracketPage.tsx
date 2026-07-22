import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../context/TournamentContext';
import MatchupCard from '../components/MatchupCard';
import RoundIndicator from '../components/RoundIndicator';
import { getRoundName, getTotalRounds } from '../utils/bracket';
import { ROUND_NAMES_32, ROUND_NAMES_16 } from '../constants';
import type { Movie } from '../types';

export default function BracketPage() {
  const { state, vote } = useTournament();
  const navigate = useNavigate();
  const [matchupIndex, setMatchupIndex] = useState(0);
  const [justVoted, setJustVoted] = useState(false);

  // 守卫
  useEffect(() => {
    if (!state.bracket || state.films.length === 0) {
      navigate('/');
    }
  }, [state.bracket, state.films, navigate]);

  // 结果页跳转
  useEffect(() => {
    if (state.bracket?.isComplete) {
      navigate('/results');
    }
  }, [state.bracket?.isComplete, navigate]);

  if (!state.bracket) return null;

  const { bracket } = state;
  const totalRounds = getTotalRounds(bracket.films.length);
  const roundNames = bracket.films.length === 32 ? ROUND_NAMES_32 : ROUND_NAMES_16;
  const currentRound = bracket.currentRound;
  const currentMatchups = bracket.matchups[currentRound] || [];

  const handleVote = (matchupId: string, winner: Movie) => {
    setJustVoted(true);
    vote(matchupId, winner);

    // 动画延迟后显示下一场
    setTimeout(() => {
      setJustVoted(false);
      // 找到下一场未投票的对阵
      const nextMatchups = bracket.matchups[currentRound];
      const nextIdx = nextMatchups.findIndex((m) => m.id === matchupId) + 1;
      if (nextIdx < nextMatchups.length) {
        setMatchupIndex(nextIdx);
      }
      // 如果本轮完成，reducer 会自动进入下一轮
      // 重置 matchupIndex
      if (nextIdx >= nextMatchups.length) {
        setMatchupIndex(0);
      }
    }, 600);
  };

  // 同步 matchupIndex（切换轮次时重置）
  useEffect(() => {
    setMatchupIndex(0);
  }, [currentRound]);

  const currentMatchup = currentMatchups[matchupIndex];
  const totalMatchups = currentMatchups.length;

  return (
    <div className="min-h-screen pb-8">
      {/* 轮次指示器 */}
      <RoundIndicator
        currentRound={currentRound}
        totalRounds={totalRounds}
        roundNames={roundNames}
      />

      {/* 当前对阵 */}
      <div className="mt-6">
        {currentMatchup && !justVoted ? (
          <MatchupCard
            key={currentMatchup.id}
            matchup={currentMatchup}
            matchupNumber={matchupIndex + 1}
            totalMatchups={totalMatchups}
            totalFilms={bracket.films.length}
            onVote={handleVote}
          />
        ) : justVoted ? (
          <div className="text-center py-16">
            <div className="text-5xl animate-bounce mb-4">✅</div>
            <p className="text-xl text-green-400 font-medium">投票成功！</p>
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-500">本轮已结束</p>
          </div>
        )}
      </div>

      {/* 轮次完成提示 */}
      {currentRound > 0 && matchupIndex === 0 && (
        <div className="text-center mt-4">
          <p className="text-sm text-gray-600">
            {getRoundName(currentRound - 1, bracket.films.length)} 已完成，进入下一轮！
          </p>
        </div>
      )}

      {/* 快速跳转 */}
      <div className="text-center mt-8">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-gray-600 hover:text-gray-400 transition-colors"
        >
          放弃当前比赛，重新开始
        </button>
      </div>
    </div>
  );
}
