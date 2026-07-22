import { useRef, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { BracketState, Person, Movie } from '../types';
import { getRoundName } from '../utils/bracket';
import { captureElement, downloadBlob } from '../utils/share';
import { APP_TITLE } from '../constants';

interface ShareImageProps {
  bracket: BracketState;
  person: Person;
}

export default function ShareImage({ bracket, person }: ShareImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const champion = bracket.champion;
  const totalFilms = bracket.films.length;

  const handleDownload = useCallback(async () => {
    if (!containerRef.current) return;
    setIsGenerating(true);
    setError('');

    // 短暂延迟确保渲染完成
    await new Promise((r) => setTimeout(r, 300));

    const blob = await captureElement(containerRef.current);
    if (blob) {
      const filename = champion
        ? `Film-World-Cup-${champion.title}.png`
        : 'Film-World-Cup.png';
      downloadBlob(blob, filename);
      setError('');
    } else {
      setError('生成图片失败，请重试');
    }

    setIsGenerating(false);
  }, [champion]);

  return (
    <div>
      {/* 下载按钮 */}
      <button
        onClick={handleDownload}
        disabled={isGenerating}
        className="w-full max-w-md mx-auto flex items-center justify-center gap-2
                   px-6 py-3 bg-indigo-600 hover:bg-indigo-500
                   disabled:bg-gray-700 disabled:opacity-50
                   rounded-xl font-medium text-white transition-all
                   disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            正在生成...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            下载分享图片
          </>
        )}
      </button>

      {error && (
        <p className="text-red-400 text-sm text-center mt-2">{error}</p>
      )}

      {/* 隐藏的渲染区域 — 用于导出图片 */}
      <div
        ref={containerRef}
        className="fixed left-[-9999px] top-0"
        style={{ width: '1080px' }}
      >
        <div className="bg-gray-950 text-white p-10" style={{ width: '1080px' }}>
          {/* 标题区 */}
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-white mb-2">{APP_TITLE}</h1>
            <p className="text-2xl text-gray-400">
              {person.name} · {person.department}
            </p>
            <p className="text-lg text-gray-600 mt-1">
              共 {totalFilms} 部电影参赛
            </p>
          </div>

          {/* 冠军 */}
          {champion && (
            <div className="text-center mb-8 p-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl mx-20">
              <p className="text-sm text-amber-400 mb-2">🏆 冠军 🏆</p>
              <div className="flex items-center justify-center gap-4">
                {champion.posterUrl && (
                  <img
                    src={champion.posterUrl}
                    alt={champion.title}
                    className="w-24 h-32 rounded-lg object-cover"
                    crossOrigin="anonymous"
                  />
                )}
                <div className="text-left">
                  <h2 className="text-3xl font-bold text-amber-400">{champion.title}</h2>
                  <p className="text-xl text-gray-300 mt-1">
                    ★ {champion.rating.toFixed(1)} · {champion.releaseYear}
                  </p>
                  <p className="text-lg text-gray-500">
                    {champion.voteCount.toLocaleString()} 人评价
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 对阵图 */}
          <div className="flex gap-4 justify-center">
            {bracket.matchups.map((round, roundIdx) => {
              const roundName = getRoundName(roundIdx, totalFilms);
              return (
                <div key={roundIdx} style={{ width: '200px' }}>
                  <h3 className="text-center text-lg font-bold text-indigo-400 mb-3">
                    {roundName}
                  </h3>
                  <div className="flex flex-col gap-2">
                    {round.map((matchup, posIdx) => {
                      const matchupH = 50 * Math.pow(2, roundIdx);
                      return (
                        <div
                          key={matchup.id}
                          className="border border-gray-700 rounded-lg p-2 bg-gray-900/50"
                          style={{ marginTop: posIdx > 0 ? matchupH - 50 : 0 }}
                        >
                          {[matchup.filmA, matchup.filmB].map((film, fi) =>
                            film ? (
                              <div
                                key={fi}
                                className={`flex items-center gap-2 p-1 rounded text-xs
                                  ${matchup.winner?.id === film.id
                                    ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                                    : 'text-gray-400'}`}
                              >
                                {film.posterUrl && (
                                  <img
                                    src={film.posterUrl}
                                    alt={film.title}
                                    className="w-8 h-10 rounded object-cover shrink-0"
                                    crossOrigin="anonymous"
                                  />
                                )}
                                <span className="truncate">
                                  {film.title}
                                  {matchup.winner?.id === film.id ? ' 👑' : ''}
                                </span>
                              </div>
                            ) : (
                              <div key={fi} className="text-gray-600 text-xs p-1">—</div>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 底部：二维码 */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-800">
            <div>
              <p className="text-lg text-gray-400">{APP_TITLE}</p>
              <p className="text-sm text-gray-600">扫码体验电影世界杯</p>
            </div>
            <div className="bg-white p-3 rounded-xl">
              <QRCodeSVG value={currentUrl} size={100} level="M" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
