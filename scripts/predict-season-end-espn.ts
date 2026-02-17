/**
 * Predict End of NBA Season 2025-2026
 * 
 * Uses ESPN API to fetch remaining schedule and generate predictions
 * 
 * Usage: npx tsx scripts/predict-season-end-espn.ts
 */

import { PrismaClient, RunStatus, DecisionStatus, PredictionStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// ESPN API Configuration
const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const SEASON_END_DATE = new Date('2026-04-15');

interface ESPNGame {
  id: string;
  date: string;
  name: string;
  shortName: string;
  competitions: [{
    competitors: [{
      id: string;
      team: {
        id: string;
        name: string;
        abbreviation: string;
        displayName: string;
      };
      homeAway: 'home' | 'away';
      winner?: boolean;
    }];
    status: {
      type: {
        name: string;
        state: string;
        completed: boolean;
      };
    };
  }];
}

interface TeamRecord {
  wins: number;
  losses: number;
  winPct: number;
}

interface PredictionResult {
  gameId: string;
  homeTeam: string;
  homeTeamAbbr: string;
  awayTeam: string;
  awayTeamAbbr: string;
  gameDate: string;
  predictedWinner: 'HOME' | 'AWAY';
  confidence: number;
  homeWinProbability: number;
  predictedScore: string;
  edge: number;
  factors: string[];
}

/**
 * Fetch upcoming games from ESPN API
 */
async function fetchUpcomingGames(): Promise<ESPNGame[]> {
  console.log('📅 Fetching upcoming games from ESPN API...');
  
  try {
    // ESPN scoreboard API - fetches games for multiple days
    const response = await fetch(`${ESPN_BASE_URL}/scoreboard?dates=20260216-20260415&limit=1000`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json() as any;
    
    if (!data.events || !Array.isArray(data.events)) {
      console.log('   ⚠️  No events found in response');
      return [];
    }
    
    // Filter only scheduled/upcoming games
    const upcomingGames = data.events.filter((game: ESPNGame) => {
      const status = game.competitions[0]?.status?.type;
      return status && (status.state === 'pre' || status.name === 'STATUS_SCHEDULED');
    });
    
    console.log(`   ✓ Found ${upcomingGames.length} upcoming games\n`);
    return upcomingGames;
    
  } catch (error) {
    console.error('   ❌ Error fetching from ESPN:', (error as Error).message);
    return [];
  }
}

/**
 * Fetch team records from ESPN
 */
async function fetchTeamRecords(): Promise<Map<string, TeamRecord>> {
  console.log('📊 Fetching team records from ESPN...');
  
  const records = new Map<string, TeamRecord>();
  
  try {
    const response = await fetch(`${ESPN_BASE_URL}/teams?limit=50`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json() as any;
    
    if (data.sports && data.sports[0]?.leagues[0]?.teams) {
      for (const teamWrapper of data.sports[0].leagues[0].teams) {
        const team = teamWrapper.team;
        if (team.record && team.record.items && team.record.items[0]) {
          const stats = team.record.items[0].stats;
          const wins = parseInt(stats.find((s: any) => s.name === 'wins')?.value || '0');
          const losses = parseInt(stats.find((s: any) => s.name === 'losses')?.value || '0');
          const winPct = parseFloat(stats.find((s: any) => s.name === 'winPercent')?.value || '0');
          
          records.set(team.abbreviation, { wins, losses, winPct });
        }
      }
    }
    
    console.log(`   ✓ Fetched records for ${records.size} teams\n`);
  } catch (error) {
    console.warn('   ⚠️  Could not fetch team records:', (error as Error).message);
  }
  
  return records;
}

/**
 * Generate prediction for a game
 */
async function generatePrediction(
  game: ESPNGame,
  teamRecords: Map<string, TeamRecord>
): Promise<PredictionResult | null> {
  const competition = game.competitions[0];
  if (!competition) return null;
  
  const homeCompetitor = competition.competitors.find(c => c.homeAway === 'home');
  const awayCompetitor = competition.competitors.find(c => c.homeAway === 'away');
  
  if (!homeCompetitor || !awayCompetitor) return null;
  
  const homeTeam = homeCompetitor.team;
  const awayTeam = awayCompetitor.team;
  const homeRecord = teamRecords.get(homeTeam.abbreviation);
  const awayRecord = teamRecords.get(awayTeam.abbreviation);
  
  // Base prediction with home court advantage
  let homeWinProb = 0.58; // Base home advantage in NBA
  const factors: string[] = ['Home court advantage'];
  
  // Factor 1: Win percentage difference
  if (homeRecord && awayRecord) {
    const winPctDiff = homeRecord.winPct - awayRecord.winPct;
    homeWinProb += winPctDiff * 0.25;
    
    if (winPctDiff > 0.15) {
      factors.push(`Much better record (${homeRecord.wins}-${homeRecord.losses} vs ${awayRecord.wins}-${awayRecord.losses})`);
    } else if (winPctDiff > 0.05) {
      factors.push(`Better record (${homeRecord.wins}-${homeRecord.losses} vs ${awayRecord.wins}-${awayRecord.losses})`);
    } else if (winPctDiff < -0.15) {
      factors.push(`Worse record (${homeRecord.wins}-${homeRecord.losses} vs ${awayRecord.wins}-${awayRecord.losses})`);
    }
  }
  
  // Factor 2: Get historical matchup data from database
  const historicalMatchup = await prisma.game.findMany({
    where: {
      OR: [
        { homeTeamName: homeTeam.name, awayTeamName: awayTeam.name },
        { homeTeamName: awayTeam.name, awayTeamName: homeTeam.name },
      ],
      status: 'completed',
      season: { gte: 2023 }, // Recent seasons only
    },
    orderBy: { gameDate: 'desc' },
    take: 5,
  });
  
  if (historicalMatchup.length > 0) {
    const homeWins = historicalMatchup.filter(g => 
      (g.homeTeamName === homeTeam.name && (g.homeScore || 0) > (g.awayScore || 0)) ||
      (g.awayTeamName === homeTeam.name && (g.awayScore || 0) > (g.homeScore || 0))
    ).length;
    
    const historicalBias = (homeWins / historicalMatchup.length - 0.5) * 0.15;
    homeWinProb += historicalBias;
    
    if (homeWins >= 3) {
      factors.push(`Historical edge (${homeWins}-${historicalMatchup.length - homeWins} in last ${historicalMatchup.length})`);
    }
  }
  
  // Clamp probability
  homeWinProb = Math.max(0.15, Math.min(0.85, homeWinProb));
  
  // Calculate confidence
  let confidence = 0.52;
  if (homeRecord && awayRecord) confidence += 0.18;
  if (historicalMatchup.length > 0) confidence += 0.15;
  if (Math.abs(homeWinProb - 0.5) > 0.15) confidence += 0.1;
  confidence = Math.min(0.92, confidence);
  
  // Predict score
  const homeScore = Math.round(110 + (homeWinProb - 0.5) * 20);
  const awayScore = Math.round(108 - (homeWinProb - 0.5) * 15);
  
  // Calculate edge
  const edge = Math.abs(homeWinProb - 0.5) * 100;
  
  return {
    gameId: game.id,
    homeTeam: homeTeam.displayName,
    homeTeamAbbr: homeTeam.abbreviation,
    awayTeam: awayTeam.displayName,
    awayTeamAbbr: awayTeam.abbreviation,
    gameDate: game.date.split('T')[0],
    predictedWinner: homeWinProb > 0.5 ? 'HOME' : 'AWAY',
    confidence,
    homeWinProbability: homeWinProb,
    predictedScore: `${Math.max(homeScore, awayScore + 2)}-${Math.min(homeScore, awayScore + 2) - 2}`,
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
  
  // Get or create system user
  let systemUser = await prisma.user.findFirst({
    where: { email: 'system@nba-analyst.local' },
  });
  
  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: {
        email: 'system@nba-analyst.local',
        password: 'system',
        role: 'admin',
      },
    });
  }
  
  const userId = systemUser.id;
  let picksCount = 0;
  let noBetCount = 0;
  
  for (const pred of predictions) {
    // Determine decision
    let status: DecisionStatus = DecisionStatus.NO_BET;
    let rationale = 'Insufficient confidence or edge';
    
    if (pred.confidence >= 0.72 && pred.edge >= 4) {
      status = DecisionStatus.PICK;
      rationale = `Strong pick: ${(pred.confidence * 100).toFixed(0)}% confidence, ${pred.edge.toFixed(1)}% edge. ${pred.factors.join(', ')}`;
      picksCount++;
    } else if (pred.confidence >= 0.6 && pred.edge >= 2.5) {
      status = DecisionStatus.NO_BET;
      rationale = `Moderate confidence (${(pred.confidence * 100).toFixed(0)}%). ${pred.factors.join(', ')}`;
      noBetCount++;
    } else {
      status = DecisionStatus.NO_BET;
      rationale = `Low confidence (${(pred.confidence * 100).toFixed(0)}%) or edge (${pred.edge.toFixed(1)}%). ${pred.factors.join(', ')}`;
      noBetCount++;
    }
    
    // Create prediction
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
        modelVersion: 'season-end-espn-v1',
        edge: pred.edge,
        status: PredictionStatus.pending,
        userId,
        runId: runId,
        traceId: `espn-${uuidv4()}`,
      },
    });
    
    // Create policy decision
    await prisma.policyDecision.create({
      data: {
        predictionId: prediction.id,
        matchId: pred.gameId,
        userId,
        status,
        rationale,
        confidenceGate: pred.confidence >= 0.6,
        edgeGate: pred.edge >= 2.5,
        driftGate: true,
        hardStopGate: false,
        matchDate: new Date(pred.gameDate),
        homeTeam: pred.homeTeam,
        awayTeam: pred.awayTeam,
        recommendedPick: status === DecisionStatus.PICK ? 
          (pred.predictedWinner === 'HOME' ? pred.homeTeam : pred.awayTeam) : null,
        confidence: pred.confidence,
        edge: pred.edge,
        modelVersion: 'season-end-espn-v1',
        executedAt: new Date(),
        traceId: `espn-${uuidv4()}`,
        runId: runId,
      },
    });
  }
  
  // Update run
  await prisma.dailyRun.update({
    where: { id: runId },
    data: {
      totalMatches: predictions.length,
      predictionsCount: predictions.length,
      picksCount,
      noBetCount,
      hardStopCount: 0,
      status: RunStatus.COMPLETED,
      completedAt: new Date(),
    },
  });
  
  console.log(`   ✓ Saved ${predictions.length} predictions`);
  console.log(`     🟢 Picks: ${picksCount}`);
  console.log(`     🟡 No-Bets: ${noBetCount}\n`);
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
  
// Create or get run for today
console.log('📅 Creating prediction run...');
let run = await prisma.dailyRun.findUnique({
  where: { runDate: today },
});

if (run) {
  console.log('   🔄 Using existing run, resetting...');
  run = await prisma.dailyRun.update({
    where: { id: run.id },
    data: {
      status: RunStatus.RUNNING,
      triggeredBy: 'season-end-espn',
      traceId: `espn-${Date.now()}`,
      totalMatches: 0,
      predictionsCount: 0,
      picksCount: 0,
      noBetCount: 0,
      hardStopCount: 0,
      errors: null,
    },
  });
} else {
  run = await prisma.dailyRun.create({
    data: {
      runDate: today,
      status: RunStatus.RUNNING,
      triggeredBy: 'season-end-espn',
      traceId: `espn-${Date.now()}`,
      totalMatches: 0,
      predictionsCount: 0,
      picksCount: 0,
      noBetCount: 0,
      hardStopCount: 0,
    },
  });
}
console.log(`   ✓ Run ID: ${run.id}\n`);
  
  // Fetch data
  const games = await fetchUpcomingGames();
  
  if (games.length === 0) {
    console.log('❌ No upcoming games found!');
    await prisma.dailyRun.update({
      where: { id: run.id },
      data: { status: RunStatus.COMPLETED },
    });
    process.exit(0);
  }
  
  const teamRecords = await fetchTeamRecords();
  
  // Generate predictions
  console.log(`🔮 Generating predictions for ${games.length} games...\n`);
  const predictions: PredictionResult[] = [];
  
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const homeTeam = game.competitions[0].competitors.find(c => c.homeAway === 'home')?.team.abbreviation;
    const awayTeam = game.competitions[0].competitors.find(c => c.homeAway === 'away')?.team.abbreviation;
    
    process.stdout.write(`   ${i + 1}/${games.length} ${awayTeam} @ ${homeTeam}... `);
    
    try {
      const prediction = await generatePrediction(game, teamRecords);
      if (prediction) {
        predictions.push(prediction);
        console.log(`✓ ${prediction.predictedWinner === 'HOME' ? homeTeam : awayTeam} (${(prediction.confidence * 100).toFixed(0)}%)`);
      } else {
        console.log('✗ Invalid game data');
      }
    } catch (error) {
      console.log(`✗ Error: ${(error as Error).message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // Save predictions
  await savePredictions(predictions, run.id);
  
  // Display summary
  console.log('\n📊 PREDICTION SUMMARY\n');
  console.log(`Total Games: ${predictions.length}`);
  console.log(`Home Wins: ${predictions.filter(p => p.predictedWinner === 'HOME').length}`);
  console.log(`Away Wins: ${predictions.filter(p => p.predictedWinner === 'AWAY').length}`);
  console.log(`Avg Confidence: ${(predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length * 100).toFixed(1)}%`);
  console.log(`Avg Edge: ${(predictions.reduce((sum, p) => sum + p.edge, 0) / predictions.length).toFixed(1)}%`);
  
  // Top picks
  console.log('\n🎯 TOP PICKS\n');
  const topPicks = predictions
    .filter(p => p.confidence >= 0.72 && p.edge >= 4)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 15);
  
  if (topPicks.length > 0) {
    topPicks.forEach((pick, i) => {
      const winner = pick.predictedWinner === 'HOME' ? pick.homeTeamAbbr : pick.awayTeamAbbr;
      console.log(`${String(i + 1).padStart(2)}. ${pick.awayTeamAbbr} @ ${pick.homeTeamAbbr} (${pick.gameDate})`);
      console.log(`    Winner: ${winner} | Confidence: ${(pick.confidence * 100).toFixed(0)}% | Edge: ${pick.edge.toFixed(1)}%`);
      console.log(`    Score: ${pick.predictedScore}`);
      console.log(`    Factors: ${pick.factors.join(', ')}\n`);
    });
  } else {
    console.log('   No high-confidence picks found.\n');
  }
  
  console.log('=====================================');
  console.log('✅ SEASON END PREDICTIONS COMPLETE');
  console.log('=====================================\n');
  
  console.log('📋 NEXT STEPS:\n');
  console.log(`   Run ID: ${run.id}`);
  console.log('   View predictions: npx prisma studio');
  console.log('   Web dashboard: npm run dev → http://localhost:3000/dashboard/picks\n');
  
  await prisma.$disconnect();
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
