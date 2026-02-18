/**
 * Seed Real Box Scores
 *
 * Backfills missing box scores from ESPN summary endpoint.
 * No synthetic stats are generated.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const NBA_STATS_API_BASE = 'https://stats.nba.com/stats';

const NBA_STATS_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Referer: 'https://www.nba.com/',
  Origin: 'https://www.nba.com',
};
const ESPN_TIMEOUT_MS = 10000;
const NBA_STATS_TIMEOUT_MS = 30000;

const finderCache = new Map<string, Array<Record<string, string | number | null>>>();
const boxScoreCache = new Map<string, ParsedBoxScore | null>();

type ParsedBoxScore = {
  homePoints: number;
  homeRebounds: number;
  homeAssists: number;
  homeSteals: number;
  homeBlocks: number;
  homeTurnovers: number;
  homeFgPct: number;
  home3pPct: number;
  homeFtPct: number;
  awayPoints: number;
  awayRebounds: number;
  awayAssists: number;
  awaySteals: number;
  awayBlocks: number;
  awayTurnovers: number;
  awayFgPct: number;
  away3pPct: number;
  awayFtPct: number;
};

type MissingBoxScoreGame = {
  id: string;
  externalId: number;
  season: number;
  seasonType: string;
  gameDate: Date;
  homeTeamAbbreviation: string;
  awayTeamAbbreviation: string;
  homeTeamName: string;
  awayTeamName: string;
};

type NbaStatsResultSet = {
  name?: string;
  headers: string[];
  rowSet: Array<Array<string | number | null>>;
};

type NbaStatsGameFinderPayload = {
  resultSets: NbaStatsResultSet[];
};

type NbaStatsBoxScorePayload = {
  resultSets: NbaStatsResultSet[];
};

const TEAM_ABBREVIATION_ALIASES: Record<string, string[]> = {
  NO: ['NOP'],
  SA: ['SAS'],
  NY: ['NYK'],
  GS: ['GSW'],
  UTAH: ['UTA'],
  PHO: ['PHX'],
  WAS: ['WSH'],
  NJ: ['BKN'],
  NOK: ['NOP'],
  SEA: ['OKC'],
  CHA: ['CHA', 'CHH'],
};

function getStatValue(stats: Array<{ name?: string; displayValue?: string }>, names: string[]): string | null {
  for (const stat of names) {
    const value = stats.find((entry) => entry.name === stat)?.displayValue;
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function parseIntegerStat(raw: string | null): number | null {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercentStat(raw: string | null): number | null {
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed > 1 ? parsed / 100 : parsed;
}

async function fetchEspnBoxScore(eventId: number): Promise<ParsedBoxScore | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ESPN_TIMEOUT_MS);
  const response = await fetch(`${ESPN_API_BASE}/summary?event=${eventId}`, { signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
  if (!response.ok) return null;

  const payload = await response.json() as {
    header?: {
      competitions?: Array<{
        competitors?: Array<{ homeAway?: 'home' | 'away'; score?: string }>;
      }>;
    };
    boxscore?: {
      teams?: Array<{
        homeAway?: 'home' | 'away';
        statistics?: Array<{ name?: string; displayValue?: string }>;
      }>;
    };
  };

  const teams = payload.boxscore?.teams ?? [];
  const home = teams.find((team) => team.homeAway === 'home');
  const away = teams.find((team) => team.homeAway === 'away');
  if (!home || !away) return null;
  const competitors = payload.header?.competitions?.[0]?.competitors ?? [];
  const homeCompetitor = competitors.find((c) => c.homeAway === 'home');
  const awayCompetitor = competitors.find((c) => c.homeAway === 'away');

  const homeStats = home.statistics ?? [];
  const awayStats = away.statistics ?? [];

  const homePoints = parseIntegerStat(homeCompetitor?.score ?? null) ?? parseIntegerStat(getStatValue(homeStats, ['points']));
  const awayPoints = parseIntegerStat(awayCompetitor?.score ?? null) ?? parseIntegerStat(getStatValue(awayStats, ['points']));

  const parsed: ParsedBoxScore = {
    homePoints: homePoints ?? -1,
    homeRebounds: parseIntegerStat(getStatValue(homeStats, ['totalRebounds', 'rebounds'])) ?? -1,
    homeAssists: parseIntegerStat(getStatValue(homeStats, ['assists'])) ?? -1,
    homeSteals: parseIntegerStat(getStatValue(homeStats, ['steals'])) ?? -1,
    homeBlocks: parseIntegerStat(getStatValue(homeStats, ['blocks'])) ?? -1,
    homeTurnovers: parseIntegerStat(getStatValue(homeStats, ['totalTurnovers', 'turnovers'])) ?? -1,
    homeFgPct: parsePercentStat(getStatValue(homeStats, ['fieldGoalPct'])) ?? -1,
    home3pPct: parsePercentStat(getStatValue(homeStats, ['threePointFieldGoalPct', 'threePointPct'])) ?? -1,
    homeFtPct: parsePercentStat(getStatValue(homeStats, ['freeThrowPct'])) ?? -1,
    awayPoints: awayPoints ?? -1,
    awayRebounds: parseIntegerStat(getStatValue(awayStats, ['totalRebounds', 'rebounds'])) ?? -1,
    awayAssists: parseIntegerStat(getStatValue(awayStats, ['assists'])) ?? -1,
    awaySteals: parseIntegerStat(getStatValue(awayStats, ['steals'])) ?? -1,
    awayBlocks: parseIntegerStat(getStatValue(awayStats, ['blocks'])) ?? -1,
    awayTurnovers: parseIntegerStat(getStatValue(awayStats, ['totalTurnovers', 'turnovers'])) ?? -1,
    awayFgPct: parsePercentStat(getStatValue(awayStats, ['fieldGoalPct'])) ?? -1,
    away3pPct: parsePercentStat(getStatValue(awayStats, ['threePointFieldGoalPct', 'threePointPct'])) ?? -1,
    awayFtPct: parsePercentStat(getStatValue(awayStats, ['freeThrowPct'])) ?? -1,
  };

  const hasMissing = Object.values(parsed).some((value) => value < 0);
  return hasMissing ? null : parsed;
}

function toNbaSeasonString(season: number, gameDate: Date): string {
  void gameDate;
  // DB season is the season end year (e.g. 2015 means 2014-15 season).
  const startYear = season - 1;
  const endYear = (startYear + 1).toString().slice(-2);
  return `${startYear}-${endYear}`;
}

function toNbaSeasonType(seasonType: string): string {
  const normalized = seasonType.toLowerCase();
  if (normalized.includes('pre')) return 'Pre Season';
  if (normalized.includes('playoff')) return 'Playoffs';
  if (normalized.includes('all')) return 'All Star';
  return 'Regular Season';
}

function toUsDate(date: Date): string {
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const yyyy = String(date.getUTCFullYear());
  return `${mm}/${dd}/${yyyy}`;
}

function toDateCandidates(gameDate: Date): Date[] {
  const oneDay = 24 * 60 * 60 * 1000;
  return [new Date(gameDate.getTime() - oneDay), gameDate, new Date(gameDate.getTime() + oneDay)];
}

async function fetchNbaStatsJson<T>(pathWithQuery: string): Promise<T | null> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NBA_STATS_TIMEOUT_MS);
    try {
      const response = await fetch(`${NBA_STATS_API_BASE}${pathWithQuery}`, {
        headers: NBA_STATS_HEADERS,
        signal: controller.signal,
      });
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as T;
    } catch {
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

function findResultSet(payload: NbaStatsBoxScorePayload | NbaStatsGameFinderPayload, name: string): NbaStatsResultSet | null {
  return payload.resultSets.find((set) => set.name === name) ?? null;
}

function getFieldMap(headers: string[], row: Array<string | number | null>): Record<string, string | number | null> {
  const mapped: Record<string, string | number | null> = {};
  for (let i = 0; i < headers.length; i++) {
    mapped[headers[i]] = row[i] ?? null;
  }
  return mapped;
}

function asNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTeamToken(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function getAbbreviationCandidates(abbreviation: string): string[] {
  const normalized = normalizeTeamToken(abbreviation);
  return [normalized, ...(TEAM_ABBREVIATION_ALIASES[normalized] ?? [])];
}

function matchesTeam(
  row: Record<string, string | number | null>,
  abbreviation: string,
  teamName: string
): boolean {
  const rowAbbreviation = normalizeTeamToken(String(row.TEAM_ABBREVIATION ?? ''));
  const rowTeamName = String(row.TEAM_NAME ?? '').toLowerCase();
  const teamNameToken = teamName.toLowerCase();

  const abbreviationCandidates = getAbbreviationCandidates(abbreviation);
  return abbreviationCandidates.includes(rowAbbreviation) || (teamNameToken.length > 0 && rowTeamName.includes(teamNameToken));
}

async function fetchNbaStatsBoxScore(game: MissingBoxScoreGame): Promise<ParsedBoxScore | null> {
  const season = toNbaSeasonString(game.season, game.gameDate);
  const primarySeasonType = toNbaSeasonType(game.seasonType);
  const seasonTypeCandidates = [
    primarySeasonType,
    ...(primarySeasonType === 'Regular Season' ? ['Playoffs'] : []),
    ...(primarySeasonType === 'Playoffs' ? ['Regular Season'] : []),
  ];

  async function getFinderRows(
    date: Date,
    seasonType: string
  ): Promise<Array<Record<string, string | number | null>>> {
    const usDate = toUsDate(date);
    const cacheKey = `${season}|${seasonType}|${usDate}`;
    const cached = finderCache.get(cacheKey);
    if (cached) return cached;

    const finderPayload = await fetchNbaStatsJson<NbaStatsGameFinderPayload>(
      `/leaguegamefinder?LeagueID=00&Season=${encodeURIComponent(season)}&SeasonType=${encodeURIComponent(seasonType)}&DateFrom=${encodeURIComponent(usDate)}&DateTo=${encodeURIComponent(usDate)}`
    );
    if (!finderPayload) {
      finderCache.set(cacheKey, []);
      return [];
    }

    const finderSet = findResultSet(finderPayload, 'LeagueGameFinderResults') ?? finderPayload.resultSets[0];
    if (!finderSet) {
      finderCache.set(cacheKey, []);
      return [];
    }

    const rows = finderSet.rowSet.map((row) => getFieldMap(finderSet.headers, row));
    finderCache.set(cacheKey, rows);
    return rows;
  }

  let gameId: string | null = null;
  for (const seasonType of seasonTypeCandidates) {
    for (const dateCandidate of toDateCandidates(game.gameDate)) {
      const rows = await getFinderRows(dateCandidate, seasonType);
      if (rows.length === 0) continue;

      const candidates = rows.filter((row) => {
        return (
          matchesTeam(row, game.homeTeamAbbreviation, game.homeTeamName) ||
          matchesTeam(row, game.awayTeamAbbreviation, game.awayTeamName)
        );
      });

      const counts = new Map<string, number>();
      for (const row of candidates) {
        const candidateGameId = String(row.GAME_ID ?? '');
        if (!candidateGameId) continue;
        counts.set(candidateGameId, (counts.get(candidateGameId) ?? 0) + 1);
      }

      const matched = [...counts.entries()].find(([, count]) => count >= 2);
      if (matched) {
        gameId = matched[0];
        break;
      }
    }

    if (gameId) {
      break;
    }
  }

  if (!gameId) return null;

  const cachedBox = boxScoreCache.get(gameId);
  if (cachedBox !== undefined) return cachedBox;

  const boxPayload = await fetchNbaStatsJson<NbaStatsBoxScorePayload>(
    `/boxscoretraditionalv2?GameID=${encodeURIComponent(gameId)}&StartPeriod=0&EndPeriod=10&StartRange=0&EndRange=28800&RangeType=0`
  );
  if (!boxPayload) {
    boxScoreCache.set(gameId, null);
    return null;
  }

  const teamStatsSet = findResultSet(boxPayload, 'TeamStats') ?? boxPayload.resultSets[1] ?? boxPayload.resultSets[0];
  if (!teamStatsSet) {
    boxScoreCache.set(gameId, null);
    return null;
  }

  const rows = teamStatsSet.rowSet.map((row) => getFieldMap(teamStatsSet.headers, row));
  const home = rows.find((row) => matchesTeam(row, game.homeTeamAbbreviation, game.homeTeamName));
  const away = rows.find((row) => matchesTeam(row, game.awayTeamAbbreviation, game.awayTeamName));
  if (!home || !away) {
    boxScoreCache.set(gameId, null);
    return null;
  }

  const parsed: ParsedBoxScore = {
    homePoints: asNumber(home.PTS) ?? -1,
    homeRebounds: asNumber(home.REB) ?? -1,
    homeAssists: asNumber(home.AST) ?? -1,
    homeSteals: asNumber(home.STL) ?? -1,
    homeBlocks: asNumber(home.BLK) ?? -1,
    homeTurnovers: asNumber(home.TO) ?? -1,
    homeFgPct: asNumber(home.FG_PCT) ?? -1,
    home3pPct: asNumber(home.FG3_PCT) ?? -1,
    homeFtPct: asNumber(home.FT_PCT) ?? -1,
    awayPoints: asNumber(away.PTS) ?? -1,
    awayRebounds: asNumber(away.REB) ?? -1,
    awayAssists: asNumber(away.AST) ?? -1,
    awaySteals: asNumber(away.STL) ?? -1,
    awayBlocks: asNumber(away.BLK) ?? -1,
    awayTurnovers: asNumber(away.TO) ?? -1,
    awayFgPct: asNumber(away.FG_PCT) ?? -1,
    away3pPct: asNumber(away.FG3_PCT) ?? -1,
    awayFtPct: asNumber(away.FT_PCT) ?? -1,
  };

  const hasMissing = Object.values(parsed).some((value) => value < 0);
  const result = hasMissing ? null : parsed;
  boxScoreCache.set(gameId, result);
  return result;
}

function parseLimitArg(): number {
  const idx = process.argv.indexOf('--limit');
  if (idx !== -1 && process.argv[idx + 1]) {
    const parsed = Number.parseInt(process.argv[idx + 1], 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 500;
}

function shouldUseNbaStatsFallback(seasonType: string): boolean {
  const normalized = seasonType.toLowerCase();
  return normalized.includes('regular') || normalized.includes('playoff');
}

async function seedBoxScores(): Promise<void> {
  const limit = parseLimitArg();
  console.log(`Backfilling real box scores (limit=${limit})...`);

  const games = await prisma.game.findMany({
    where: {
      boxScore: null,
      status: 'completed',
      homeScore: { not: null },
      awayScore: { not: null },
    },
    select: {
      id: true,
      externalId: true,
      season: true,
      seasonType: true,
      gameDate: true,
      homeTeamAbbreviation: true,
      awayTeamAbbreviation: true,
      homeTeamName: true,
      awayTeamName: true,
    },
    // Oldest-first improves fallback success rate for legacy seasons.
    orderBy: { gameDate: 'asc' },
    take: limit,
  });

  console.log(`Found ${games.length} completed games without box score`);
  let created = 0;
  let skipped = 0;
  let espnHits = 0;
  let nbaStatsHits = 0;

  for (const game of games) {
    try {
      let box = await fetchEspnBoxScore(game.externalId);
      let source: 'espn' | 'nba_stats' | null = box ? 'espn' : null;
      if (!box && shouldUseNbaStatsFallback(game.seasonType)) {
        box = await fetchNbaStatsBoxScore(game);
        source = box ? 'nba_stats' : null;
      }

      if (!box) {
        skipped++;
        continue;
      }

      await prisma.boxScore.upsert({
        where: { gameId: game.id },
        update: {
          ...box,
          fetchedAt: new Date(),
        },
        create: {
          id: `bs-${game.externalId}`,
          gameId: game.id,
          ...box,
        },
      });

      created++;
      if (source === 'espn') espnHits++;
      if (source === 'nba_stats') nbaStatsHits++;
      if ((created + skipped) % 10 === 0) {
        console.log(`Processed ${created + skipped}/${games.length} (espn=${espnHits}, nba_stats=${nbaStatsHits})`);
      }
    } catch (error) {
      skipped++;
      console.warn(`Failed event=${game.externalId}:`, error);
    }
  }

  console.log('Done');
  console.log(`Created/updated: ${created}`);
  console.log(`From ESPN: ${espnHits}`);
  console.log(`From nba.com stats fallback: ${nbaStatsHits}`);
  console.log(`Skipped (no reliable real box score source): ${skipped}`);
}

seedBoxScores()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
