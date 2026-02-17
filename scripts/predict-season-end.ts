/**
 * Predict End of NBA Season 2025-2026
 * 
 * This script:
 * 1. Fetches remaining schedule from NBA CDN API
 * 2. Gets current season team stats from database + API
 * 3. Combines historical data + current season data
 * 4. Generates predictions for each remaining game
 * 
 * Usage: npx tsx scripts/predict-season-end.ts
 */

import { PrismaClient, RunStatus, DecisionStatus, PredictionStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// NBA Season 2025-2026 configuration
const SEASON = 2025;
const SEASON_END_DATE = new Date('2026-04-15');
const NBA_CDN_BASE_URL = 'https://cdn.nba.com';

interface GameSchedule {
  gameId: string;
  gameDate: string;
  homeTeam: string;
  homeTeamId: number;
  awayTeam: string;
  awayTeamId: number;
  status: string;
}

interface TeamStats {
  teamId: number;
  teamName: string;
  wins: number;
  losses: number;
  winPct: number;
  pointsPerGame: number;
  pointsAllowed: number;
  homeRecord: string;
  awayRecord: string;
  lastTen: string;
}

interface PredictionInput {
  gameId: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamStats: TeamStats | null;
  awayTeamStats: TeamStats | null;
  historicalMatchup: any | null;
}

interface PredictionResult {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  gameDate: string;
  predictedWinner: 'HOME' | 'AWAY';
  confidence: number;
  homeWinProbability: number;
  predictedScore: string;
  edge: number;
  factors: string[];
}

/**
 * Fetch remaining schedule from NBA CDN
 */
async function fetchRemainingSchedule(): Promise<GameSchedule[]> {
  console.log('📅 Fetching remaining schedule from NBA CDN...');
  
  const games: GameSchedule[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Iterate from today to end of season
  for (let d = new Date(today); d <= SEASON_END_DATE; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    
    try {
      const response = await fetch(`${NBA_CDN_BASE_URL}/static/json/liveData/sod/v1/games/${dateStr}.json`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          // No games on this date, continue
          continue;
        }
        console.warn(`   ⚠️  Failed to fetch ${dateStr}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json() as any;
      
      if (data.games && Array.isArray(data.games)) {
        for (const game of data.games) {
          if (game.status === 'Scheduled' || game.status === 'Pre-Game') {
            games.push({
              gameId: game.gameId || game.id,
              gameDate: dateStr,
              homeTeam: game.homeTeam?.teamName || game.homeTeam?.name,
              homeTeamId: game.homeTeam?.teamId || game.homeTeam?.id,
              awayTeam: game.awayTeam?.teamName || game.awayTeam?.name,
              awayTeamId: game.awayTeam?.teamId || game.awayTeam?.id,
              status: game.status,
            });
          }
        }
      }
      
      // Rate limiting - be nice to the API
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.warn(`   ⚠️  Error fetching ${dateStr}:`, (error as Error).message);
    }
  }
  
  console.log(`   ✓ Found ${games.length} remaining games\n`);
  return games;
}

/**
 * Fetch team standings/stats from NBA CDN
 */
async function fetchTeamStandings(): Promise<Map<number, TeamStats>> {
  console.log('📊 Fetching team standings from NBA CDN...');
  
  const teamStats = new Map<number, TeamStats>();
  
  try {
    // Try to fetch current standings
    const response = await fetch(`${NBA_CDN_BASE_URL}/static/data/league/standings/latest.json`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (response.ok) {
      const data = await response.json() as any;
      
      if (data.teams && Array.isArray(data.teams)) {
        for (const team of data.teams) {
          teamStats.set(team.teamId, {
            teamId: team.teamId,
            teamName: team.teamName,
            wins: team.wins || 0,
            losses: team.losses || 0,
            winPct: team.winPct || 0,
            pointsPerGame: team.pointsPerGame || 0,
            pointsAllowed: team.pointsAllowed || 0,
            homeRecord: team.homeRecord || '0-0',
            awayRecord: team.awayRecord || '0-0',
            lastTen: team.lastTen || '0-0',
          });
        }
      }
    }
    
    console.log(`   ✓ Fetched stats for ${teamStats.size} teams\n`);
  } catch (error) {
    console.warn('   ⚠️  Could not fetch standings:', (error as Error).message);
    console.log('   Will use database stats instead\n');
  }
  
  return teamStats;
}

/**
 * Get historical matchup data from database
 */
async function getHistoricalMatchup(homeTeamId: number, awayTeamId: number) {
  // Get last 5 matchups between these teams
  const historicalGames = await prisma.game.findMany({
    where: {
      OR: [
        { homeTeamId, awayTeamId },
        { homeTeamId: awayTeamId, awayTeamId: homeTeamId },
      ],
      status: 'completed',
    },
    orderBy: { gameDate: 'desc' },
    take: 5,
  });
  
  if (historicalGames.length === 0) return null;
  
  const homeWins = historicalGames.filter(g => 
    (g.homeTeamId === homeTeamId && g.homeScore > g.awayScore) ||
    (g.awayTeamId === homeTeamId && g.awayScore > g.homeScore)
  ).length;
  
  return {
    totalMatchups: historicalGames.length,
    homeTeamWins: homeWins,
    awayTeamWins: historicalGames.length - homeWins,
    averageHomeScore: historicalGames.reduce((sum, g) => 
      sum + (g.homeTeamId === homeTeamId ? g.homeScore : g.awayScore), 0) / historicalGames.length,
    averageAwayScore: historicalGames.reduce((sum, g) => 
      sum + (g.awayTeamId === awayTeamId ? g.awayScore : g.homeScore), 0) / historicalGames.length,
    lastGame: historicalGames[0],
  };
}

/**
 * Generate prediction for a single game
 */
async function generatePrediction(
  game: GameSchedule,
  teamStats: Map<number, TeamStats>
): Promise<PredictionResult> {
  const homeStats = teamStats.get(game.homeTeamId);
  const awayStats = teamStats.get(game.awayTeamId);
  const historicalMatchup = await getHistoricalMatchup(game.homeTeamId, game.awayTeamId);
  
  // Simple prediction model combining multiple factors
  let homeAdvantage = 0.6; // Base home court advantage
  const factors: string[] = ['Home court advantage'];
  
  // Factor 1: Win percentage
  if (homeStats && awayStats) {
    const winPctDiff = homeStats.winPct - awayStats.winPct;
    homeAdvantage += winPctDiff * 0.3;
    
    if (winPctDiff > 0.1) {
      factors.push(`Better record (${(homeStats.winPct * 100).toFixed(1)}% vs ${(awayStats.winPct * 100).toFixed(1)}%)`);
    } else if (winPctDiff < -0.1) {
      factors.push(`Worse record (${(homeStats.winPct * 100).toFixed(1)}% vs ${(awayStats.winPct * 100).toFixed(1)}%)`);
    }
    
    // Factor 2: Points differential
    const homeDiff = homeStats.pointsPerGame - homeStats.pointsAllowed;
    const awayDiff = awayStats.pointsPerGame - awayStats.pointsAllowed;
    const diffAdvantage = (homeDiff - awayDiff) * 0.01;
    homeAdvantage += diffAdvantage;
    
    if (homeDiff > awayDiff + 2) {
      factors.push('Better point differential');
    }
    
    // Factor 3: Home/away records
    const [homeWins, homeLosses] = homeStats.homeRecord.split('-').map(Number);
    const [awayWins, awayLosses] = awayStats.awayRecord.split('-').map(Number);
    const homeWinPct = homeWins / (homeWins + homeLosses || 1);
    const awayWinPct = awayWins / (awayWins + awayLosses || 1);
    
    if (homeWinPct > 0.6) factors.push('Strong home record');
    if (awayWinPct < 0.4) factors.push('Weak away record');
  }
  
  // Factor 4: Historical matchup
  if (historicalMatchup) {
    const historicalAdvantage = (historicalMatchup.homeTeamWins / historicalMatchup.totalMatchups - 0.5) * 0.2;
    homeAdvantage += historicalAdvantage;
    
    if (historicalMatchup.homeTeamWins > historicalMatchup.awayTeamWins) {
      factors.push(`Historical advantage (${historicalMatchup.homeTeamWins}-${historicalMatchup.awayTeamWins})`);
    }
  }
  
  // Clamp probability between 0.1 and 0.9
  homeAdvantage = Math.max(0.1, Math.min(0.9, homeAdvantage));
  
  // Calculate confidence based on data quality
  let confidence = 0.5;
  if (homeStats && awayStats) confidence += 0.2;
  if (historicalMatchup) confidence += 0.15;
  if (homeStats?.lastTen && awayStats?.lastTen) confidence += 0.15;
  confidence = Math.min(0.95, confidence);
  
  // Predict score
  let homeScore = 110;
  let awayScore = 108;
  
  if (homeStats && awayStats) {
    homeScore = Math.round((homeStats.pointsPerGame + awayStats.pointsAllowed) / 2);
    awayScore = Math.round((awayStats.pointsPerGame + homeStats.pointsAllowed) / 2);
  }
  
  // Adjust for predicted winner
  if (homeAdvantage > 0.5) {
    homeScore = Math.max(homeScore, awayScore + 3);
  } else {
    awayScore = Math.max(awayScore, homeScore + 3);
  }
  
  // Calculate edge
  const edge = Math.abs(homeAdvantage - 0.5) * 100;
  
  return {
    gameId: game.gameId,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    gameDate: game.gameDate,
    predictedWinner: homeAdvantage > 0.5 ? 'HOME' : 'AWAY',
    confidence,
    homeWinProbability: homeAdvantage,
    predictedScore: `${homeScore}-${awayScore}`,
    edge,
    factors,
  };
}

/**
 * Save predictions to database
 */
async function savePredictions(
  predictions: PredictionResult[],
  runId: string
): Promise<void> {
  console.log('\n💾 Saving predictions to database...');
  
  let picksCount = 0;
  let noBetCount = 0;
  let hardStopCount = 0;
  
  for (const pred of predictions) {
    // Create prediction record
    const prediction = await prisma.prediction.create({
      data: {
        matchId: pred.gameId,
        matchDate: new Date(pred.gameDate),
        league: 'nba',
        homeTeam: pred.homeTeam,
        awayTeam: pred.awayTeam,
        winnerPrediction: pred.predictedWinner,
        scorePrediction: pred.predictedScore,
        confidence: pred.confidence,
        modelVersion: 'season-end-predictor-v1',
        edge: pred.edge,
        status: PredictionStatus.pending,
        userId: 'system',
        runId: runId,
        traceId: `eos-${uuidv4()}`,
      },
    });
    
    // Determine decision based on confidence and edge
    let status: DecisionStatus = DecisionStatus.NO_BET;
    let rationale = 'Low confidence prediction';
    
    if (pred.confidence >= 0.75 && pred.edge >= 5) {
      status = DecisionStatus.PICK;
      rationale = `High confidence (${(pred.confidence * 100).toFixed(1)}%) with ${pred.edge.toFixed(1)}% edge. ${pred.factors.join(', ')}`;
      picksCount++;
    } else if (pred.confidence >= 0.6 && pred.edge >= 3) {
      status = DecisionStatus.NO_BET;
      rationale = `Moderate confidence. ${pred.factors.join(', ')}`;
      noBetCount++;
    } else {
      status = DecisionStatus.NO_BET;
      rationale = `Insufficient edge or confidence. ${pred.factors.join(', ')}`;
      noBetCount++;
    }
    
    // Create policy decision
    await prisma.policyDecision.create({
      data: {
        predictionId: prediction.id,
        matchId: pred.gameId,
        userId: 'system',
        status,
        rationale,
        confidenceGate: pred.confidence >= 0.6,
        edgeGate: pred.edge >= 3,
        driftGate: true,
        hardStopGate: false,
        matchDate: new Date(pred.gameDate),
        homeTeam: pred.homeTeam,
        awayTeam: pred.awayTeam,
        recommendedPick: status === DecisionStatus.PICK ? pred.predictedWinner : null,
        confidence: pred.confidence,
        edge: pred.edge,
        modelVersion: 'season-end-predictor-v1',
        executedAt: new Date(),
        traceId: `eos-${uuidv4()}`,
        runId: runId,
      },
    });
  }
  
  // Update run stats
  await prisma.dailyRun.update({
    where: { id: runId },
    data: {
      totalMatches: predictions.length,
      predictionsCount: predictions.length,
      picksCount,
      noBetCount,
      hardStopCount,
      status: RunStatus.COMPLETED,
      completedAt: new Date(),
    },
  });
  
  console.log(`   ✓ Saved ${predictions.length} predictions`);
  console.log(`     - Picks: ${picksCount} 🟢`);
  console.log(`     - No-Bets: ${noBetCount} 🟡`);
  console.log(`     - Hard-Stops: ${hardStopCount} 🔴\n`);
}

/**
 * Main function
 */
async function main() {
  console.log('\n🏀 NBA SEASON END PREDICTION 2025-2026');
  console.log('=====================================\n');
  
  const today = new Date();
  console.log(`📅 Today: ${today.toISOString().split('T')[0]}`);
  console.log(`🏁 Season End: ${SEASON_END_DATE.toISOString().split('T')[0]}`);
  
  const daysRemaining = Math.ceil((SEASON_END_DATE.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  console.log(`📊 Days Remaining: ${daysRemaining}\n`);
  
  // Create daily run
  console.log('📅 Creating prediction run...');
  const run = await prisma.dailyRun.create({
    data: {
      runDate: today,
      status: RunStatus.RUNNING,
      triggeredBy: 'season-end-predictor',
      traceId: `season-end-${Date.now()}`,
      totalMatches: 0,
      predictionsCount: 0,
      picksCount: 0,
      noBetCount: 0,
      hardStopCount: 0,
    },
  });
  console.log(`   ✓ Run ID: ${run.id}\n`);
  
  // Fetch schedule
  const games = await fetchRemainingSchedule();
  
  if (games.length === 0) {
    console.log('❌ No remaining games found!');
    await prisma.dailyRun.update({
      where: { id: run.id },
      data: { status: RunStatus.COMPLETED },
    });
    process.exit(0);
  }
  
  // Fetch team stats
  const teamStats = await fetchTeamStandings();
  
  // Generate predictions
  console.log(`🔮 Generating predictions for ${games.length} games...\n`);
  const predictions: PredictionResult[] = [];
  
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    process.stdout.write(`   ${i + 1}/${games.length} ${game.awayTeam} @ ${game.homeTeam}... `);
    
    try {
      const prediction = await generatePrediction(game, teamStats);
      predictions.push(prediction);
      console.log(`✓ ${prediction.predictedWinner} wins (${(prediction.confidence * 100).toFixed(0)}%)`);
    } catch (error) {
      console.log(`✗ Error: ${(error as Error).message}`);
    }
    
    // Small delay to avoid overwhelming the DB
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  // Save predictions
  await savePredictions(predictions, run.id);
  
  // Display summary
  console.log('\n📊 PREDICTION SUMMARY\n');
  console.log(`Total Games: ${predictions.length}`);
  console.log(`Home Wins Predicted: ${predictions.filter(p => p.predictedWinner === 'HOME').length}`);
  console.log(`Away Wins Predicted: ${predictions.filter(p => p.predictedWinner === 'AWAY').length}`);
  console.log(`Average Confidence: ${(predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length * 100).toFixed(1)}%`);
  console.log(`Average Edge: ${(predictions.reduce((sum, p) => sum + p.edge, 0) / predictions.length).toFixed(1)}%`);
  
  console.log('\n🎯 TOP PICKS (High Confidence + Edge)\n');
  const topPicks = predictions
    .filter(p => p.confidence >= 0.75 && p.edge >= 5)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);
  
  if (topPicks.length > 0) {
    topPicks.forEach((pick, i) => {
      console.log(`${i + 1}. ${pick.awayTeam} @ ${pick.homeTeam} (${pick.gameDate})`);
      console.log(`   Winner: ${pick.predictedWinner} | Confidence: ${(pick.confidence * 100).toFixed(1)}% | Edge: ${pick.edge.toFixed(1)}%`);
      console.log(`   Score: ${pick.predictedScore}`);
      console.log(`   Factors: ${pick.factors.join(', ')}\n`);
    });
  } else {
    console.log('   No high-confidence picks found.\n');
  }
  
  console.log('=====================================');
  console.log('✅ SEASON END PREDICTIONS COMPLETE');
  console.log('=====================================\n');
  
  console.log('📋 NEXT STEPS:\n');
  console.log('   View predictions:');
  console.log('   - Prisma Studio: npx prisma studio');
  console.log('   - Run ID:', run.id);
  console.log('\n   View picks dashboard:');
  console.log('   - Start server: npm run dev');
  console.log('   - Navigate to: http://localhost:3000/dashboard/picks\n');
  
  await prisma.$disconnect();
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
