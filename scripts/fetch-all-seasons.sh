#!/bin/bash
# Fetch all NBA seasons from 2015-2026 with player data
# Phase 6 Implementation - Batch processing with recovery

SEASONS=(
  "2015-10-27:2016-06-19:2015"
  "2016-10-25:2017-06-12:2016"
  "2017-10-17:2018-06-08:2017"
  "2018-10-16:2019-06-13:2018"
  "2019-10-22:2020-10-11:2019"
  "2020-12-22:2021-07-20:2020"
  "2021-10-19:2022-06-16:2021"
  "2022-10-18:2023-06-12:2022"
  "2023-10-24:2024-06-17:2023"
  "2024-10-22:2025-06-17:2024"
  "2025-10-22:2026-02-16:2025"
)

LOG_FILE="fetch-all-seasons-$(date +%Y%m%d-%H%M%S).log"
ERROR_LOG="fetch-all-seasons-errors-$(date +%Y%m%d-%H%M%S).log"

echo "==========================================" | tee -a "$LOG_FILE"
echo "NBA Historical Data Fetch - All Seasons" | tee -a "$LOG_FILE"
echo "Started: $(date)" | tee -a "$LOG_FILE"
echo "==========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

TOTAL_SEASONS=${#SEASONS[@]}
CURRENT=0

for season in "${SEASONS[@]}"; do
  IFS=':' read -r start end year <<< "$season"
  CURRENT=$((CURRENT + 1))
  
  echo "" | tee -a "$LOG_FILE"
  echo "==========================================" | tee -a "$LOG_FILE"
  echo "[$CURRENT/$TOTAL_SEASONS] Fetching season $year" | tee -a "$LOG_FILE"
  echo "Date range: $start to $end" | tee -a "$LOG_FILE"
  echo "==========================================" | tee -a "$LOG_FILE"
  echo "Started: $(date)" | tee -a "$LOG_FILE"
  
  # Fetch season data with players and injuries
  npx ts-node scripts/fetch-historical-data-full.ts \
    --start-date="$start" \
    --end-date="$end" \
    --season="$year" \
    --include-players \
    --include-injuries \
    --update-rosters \
    --resume-from-last 2>&1 | tee -a "$LOG_FILE"
  
  EXIT_CODE=${PIPESTATUS[0]}
  
  if [ $EXIT_CODE -ne 0 ]; then
    echo "ERROR: Season $year failed with exit code $EXIT_CODE" | tee -a "$ERROR_LOG"
    echo "Season $year failed at $(date)" | tee -a "$ERROR_LOG"
    echo "You can resume from this season by running:" | tee -a "$ERROR_LOG"
    echo "  ./scripts/fetch-all-seasons.sh --resume-from=$year" | tee -a "$ERROR_LOG"
    
    # Continue to next season instead of exiting
    echo "Continuing to next season..." | tee -a "$LOG_FILE"
  else
    echo "Season $year completed successfully at $(date)" | tee -a "$LOG_FILE"
  fi
  
  # Pause between seasons to avoid rate limiting
  echo "Pausing 60 seconds before next season..." | tee -a "$LOG_FILE"
  sleep 60
done

echo "" | tee -a "$LOG_FILE"
echo "==========================================" | tee -a "$LOG_FILE"
echo "All seasons completed!" | tee -a "$LOG_FILE"
echo "Finished: $(date)" | tee -a "$LOG_FILE"
echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"
echo "Error log: $ERROR_LOG" | tee -a "$LOG_FILE"
echo "==========================================" | tee -a "$LOG_FILE"
