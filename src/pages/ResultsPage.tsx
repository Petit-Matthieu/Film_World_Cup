import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../context/TournamentContext';
import BracketView from '../components/BracketView';
import ShareImage from '../components/ShareImage';

export default function ResultsPage() {
  const { state, reset } = useTournament();
  const navigate = useNavigate();

  // 守卫
  useEffect(() => {
    if (!state.bracket || !state.bracket.isComplete) {
      navigate('/bracket');
    }
  }, [state.bracket, navigate]);

  if (!state.bracket || !state.bracket.isComplete) return null;

  const { bracket } = state;
  const champion = bracket.champion;

  const handleNewTournament = () => {
    reset();
    navigate('/');
  };

  return (
    <div className="min-h-screen pb-8">
      {/* 冠军英雄区 */}
      {champion && (
        <div className="text-center py-8 px-4 bg-gradient-to-b from-amber-500/10 to-transparent">
          <div className="text-5xl mb-4 animate-bounce">🏆</div>
          <p className="text-sm text-amber-400 font-medium mb-2">CHAMPION</p>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-1">
            {champion.title}
          </h1>
          {champion.titleEn && (
            <p className="text-lg text-gray-400 mb-2">{champion.titleEn}</p>
          )}
          <div className="flex items-center justify-center gap-3 text-gray-400 text-sm">
            <span className="text-amber-400 font-bold">★ {champion.rating.toFixed(1)}</span>
            <span>{champion.releaseYear}</span>
            <span>{champion.voteCount.toLocaleString()} 人评价</span>
          </div>

          {/* 冠军海报 */}
          {champion.posterUrl && (
            <div className="mt-6 mx-auto w-32 h-44 rounded-xl overflow-hidden shadow-2xl shadow-amber-500/20 border-2 border-amber-500/50">
              <img
                src={champion.posterUrl}
                alt={champion.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <p className="text-gray-500 text-sm mt-4">
            {state.person?.name} · {state.bracket.films.length} 部电影参赛
          </p>
        </div>
      )}

      {/* 对阵图标题 */}
      <div className="text-center mt-6 mb-4">
        <h2 className="text-lg font-bold text-white">完整对阵图</h2>
      </div>

      {/* 对阵图 */}
      <BracketView bracket={bracket} />

      {/* 分享区域 */}
      {state.person && (
        <div className="mt-8 px-4">
          <ShareImage bracket={bracket} person={state.person} />
        </div>
      )}

      {/* 再来一次 */}
      <div className="text-center mt-8 px-4">
        <button
          onClick={handleNewTournament}
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700
                     rounded-xl text-white font-medium transition-all
                     border border-gray-700"
        >
          🔄 开始新的比赛
        </button>
      </div>
    </div>
  );
}
