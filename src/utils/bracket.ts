import type { Movie, Matchup, BracketState } from '../types';

/**
 * 标准种子排布：1 vs N, 2 vs N-1, ...
 * 种子1在上半区，种子2在下半区，以此类推
 */
export function seedFilms(films: Movie[]): Movie[] {
  const n = films.length;
  const seeded: (Movie | null)[] = new Array(n).fill(null);
  let left = 0;
  let right = n - 1;
  let idx = 0;

  while (left <= right) {
    if (left === right) {
      seeded[left] = films[idx];
      break;
    }
    seeded[left] = films[idx];
    seeded[right] = films[idx + 1];
    left++;
    right--;
    idx += 2;
  }

  return seeded.filter((m): m is Movie => m !== null);
}

/**
 * 计算总轮次
 */
export function getTotalRounds(filmCount: number): number {
  return Math.log2(filmCount);
}

/**
 * 根据电影列表生成完整的对阵表
 */
export function buildBracket(films: Movie[]): BracketState {
  const seeded = seedFilms(films);
  const totalRounds = getTotalRounds(seeded.length);
  const matchups: Matchup[][] = [];

  // Round 0: 从种子电影创建对阵
  const round0: Matchup[] = [];
  for (let i = 0; i < seeded.length; i += 2) {
    round0.push({
      id: `round-0-pos-${i / 2}`,
      roundIndex: 0,
      position: i / 2,
      filmA: seeded[i],
      filmB: seeded[i + 1] ?? null,
      winner: null,
    });
  }
  matchups.push(round0);

  // 后续轮次：占位
  for (let round = 1; round < totalRounds; round++) {
    const prevCount = matchups[round - 1].length;
    const roundMatchups: Matchup[] = [];
    for (let pos = 0; pos < prevCount / 2; pos++) {
      roundMatchups.push({
        id: `round-${round}-pos-${pos}`,
        roundIndex: round,
        position: pos,
        filmA: null,
        filmB: null,
        winner: null,
      });
    }
    matchups.push(roundMatchups);
  }

  return {
    matchups,
    films: seeded,
    currentRound: 0,
    champion: null,
    isComplete: false,
  };
}

/**
 * 投票后传播赢家到下一轮
 * 返回新的 matchups 数组
 */
export function propagateWinner(
  matchups: Matchup[][],
  votedMatchup: Matchup
): Matchup[][] {
  const newMatchups = matchups.map((round) =>
    round.map((m) => ({ ...m }))
  );

  // 更新投票的对阵
  const target = newMatchups[votedMatchup.roundIndex][votedMatchup.position];
  target.winner = votedMatchup.winner;

  // 如果已经是最后一轮，不再传播
  const nextRound = votedMatchup.roundIndex + 1;
  if (nextRound >= newMatchups.length) return newMatchups;

  // 传播到下一轮
  const nextPos = Math.floor(votedMatchup.position / 2);
  const nextMatchup = newMatchups[nextRound][nextPos];

  if (!nextMatchup.filmA) {
    nextMatchup.filmA = votedMatchup.winner;
  } else {
    nextMatchup.filmB = votedMatchup.winner;
  }

  return newMatchups;
}

/**
 * 判断当前回合是否全部完成投票
 */
export function isRoundComplete(matchups: Matchup[][], roundIndex: number): boolean {
  const round = matchups[roundIndex];
  if (!round) return false;
  return round.every((m) => m.winner !== null);
}

/**
 * 获取轮次名称
 */
export function getRoundName(roundIndex: number, totalFilms: number): string {
  if (totalFilms === 32) {
    const names = ['32强赛', '16强赛', '四分之一决赛', '半决赛', '决赛'];
    return names[roundIndex] || `第${roundIndex + 1}轮`;
  }
  const names = ['16强赛', '四分之一决赛', '半决赛', '决赛'];
  return names[roundIndex] || `第${roundIndex + 1}轮`;
}

/**
 * 获取冠军
 */
export function getChampion(matchups: Matchup[][]): Movie | null {
  const lastRound = matchups[matchups.length - 1];
  if (!lastRound || lastRound.length === 0) return null;
  return lastRound[0]?.winner || null;
}

/**
 * 选择适合的电影数量（32 或 16）
 */
export function selectFilmCount(availableCount: number): number {
  if (availableCount >= 32) return 32;
  if (availableCount >= 16) return 16;
  return 0; // 不够16部
}
