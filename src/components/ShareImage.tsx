import { useRef, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { BracketState, Person } from '../types';
import { getRoundName } from '../utils/bracket';
import { captureElement, downloadBlob } from '../utils/share';
import { APP_TITLE } from '../constants';

const APP_URL = 'https://petit-matthieu.github.io/Film_World_Cup/';

interface ShareImageProps {
  bracket: BracketState;
  person: Person;
}

export default function ShareImage({ bracket, person }: ShareImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState('');

  const champion = bracket.champion;
  const totalFilms = bracket.films.length;

  const handleGenerate = useCallback(async () => {
    setShowPreview(true);
    await new Promise((r) => setTimeout(r, 800)); // 等渲染+图片加载
    setIsGenerating(true);
    setError('');

    if (!containerRef.current) {
      setError('渲染失败');
      setIsGenerating(false);
      return;
    }

    const blob = await captureElement(containerRef.current);
    if (blob) {
      const filename = champion
        ? `Film-World-Cup-${champion.title}.png`
        : 'Film-World-Cup.png';
      downloadBlob(blob, filename);
    } else {
      setError('生成图片失败，请重试');
    }
    setIsGenerating(false);
    setShowPreview(false);
  }, [champion]);

  return (
    <div>
      <button
        onClick={handleGenerate}
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

      {error && <p className="text-red-400 text-sm text-center mt-2">{error}</p>}

      {/* 可见预览弹窗 */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-auto py-8"
             onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(false); }}>
          <div
            ref={containerRef}
            className="bg-[#0a0a10] text-white flex-shrink-0"
            style={{ width: '1080px' }}
          >
            <div className="p-10">
              {/* ============ 顶部标题 ============ */}
              <div className="text-center mb-8">
                <div className="text-5xl mb-3">🏆🎬</div>
                <h1 className="text-4xl font-black text-white">{APP_TITLE}</h1>
                <p className="text-xl text-gray-400 mt-2">{person.name} · {person.department}</p>
                <p className="text-base text-gray-600 mt-1">{totalFilms} 部电影参赛</p>
              </div>

              {/* ============ 冠军 — 居中大图 ============ */}
              {champion && (
                <div className="text-center mb-10">
                  <p className="text-base text-amber-400 font-medium mb-4">🏆 CHAMPION 🏆</p>
                  <div className="flex items-center justify-center gap-6">
                    {champion.posterUrl && (
                      <img
                        src={champion.posterUrl}
                        alt={champion.title}
                        className="w-36 h-52 rounded-xl object-cover shadow-2xl border-2 border-amber-400/50"
                      />
                    )}
                    <div className="text-left">
                      <h2 className="text-3xl font-black text-amber-400">{champion.title}</h2>
                      {champion.titleEn && (
                        <p className="text-lg text-gray-400 mt-0.5">{champion.titleEn}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-base text-gray-300">
                        <span>★ {champion.rating.toFixed(1)}</span>
                        <span>{champion.releaseYear}</span>
                      </div>
                      <p className="text-sm text-gray-500">{champion.voteCount.toLocaleString()} 人评价</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ============ 对阵图 — 横向树 ============ */}
              <div className="flex gap-4 justify-center mb-8">
                {bracket.matchups.map((round, roundIdx) => {
                  const roundName = getRoundName(roundIdx, totalFilms);
                  const gap = Math.pow(2, roundIdx) * 24;
                  return (
                    <div key={roundIdx} style={{ width: '210px' }} className="shrink-0">
                      <h3 className="text-center text-base font-bold text-indigo-400 mb-3">{roundName}</h3>
                      <div className="flex flex-col" style={{ gap: `${gap}px` }}>
                        {round.map((matchup) => (
                          <div key={matchup.id} className="border border-gray-700/50 rounded-lg p-2 bg-gray-900/40">
                            {[matchup.filmA, matchup.filmB].map((film, fi) =>
                              film ? (
                                <div key={fi}
                                  className={`flex items-center gap-2 p-1.5 rounded text-xs
                                    ${matchup.winner?.id === film.id
                                      ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
                                      : 'text-gray-300'}`}
                                >
                                  {film.posterUrl && (
                                    <img src={film.posterUrl} alt={film.title}
                                      className="w-9 h-12 rounded object-cover shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <span className="block truncate font-medium">{film.title}</span>
                                    {film.titleEn && (
                                      <span className="block truncate text-gray-500 text-[10px]">{film.titleEn}</span>
                                    )}
                                    <span className="text-gray-600 text-[10px]">
                                      ★ {film.rating.toFixed(1)}
                                      {matchup.winner?.id === film.id ? ' 👑' : ''}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div key={fi} className="text-gray-600 text-xs p-1.5">—</div>
                              )
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ============ 底部 ============ */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-800">
                <div>
                  <p className="text-lg text-gray-400 font-bold">{APP_TITLE}</p>
                  <p className="text-sm text-gray-600">扫码创建你的电影世界杯</p>
                </div>
                <div className="bg-white p-3 rounded-xl">
                  <QRCodeSVG value={APP_URL} size={110} level="M" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
