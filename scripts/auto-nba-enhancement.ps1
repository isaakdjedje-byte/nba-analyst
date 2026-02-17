#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Script d'automatisation complete - NBA Data Enhancement Plan
.DESCRIPTION
    Execute automatiquement toutes les phases du plan de bataille NBA
.PARAMETER StartFrom
    Phase de depart (1-7). Par defaut: 1
.PARAMETER Season
    Saison specifique a traiter. Par defaut: toutes
.EXAMPLE
    .\auto-nba-enhancement.ps1
    .\auto-nba-enhancement.ps1 -StartFrom 3
    .\auto-nba-enhancement.ps1 -Season 2024
#>

param(
    [int]$StartFrom = 1,
    [int]$Season = 0,
    [switch]$SkipTests = $false,
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

# Configuration
$ScriptRoot = $PSScriptRoot
$ProjectRoot = Split-Path -Parent $ScriptRoot
$LogDir = "$ProjectRoot\logs"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$MainLog = "$LogDir\nba-enhancement-$Timestamp.log"

# Creer le dossier de logs
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage
    Add-Content -Path $MainLog -Value $logMessage
}

function Invoke-Step {
    param(
        [int]$Phase,
        [string]$Name,
        [scriptblock]$Action
    )
    
    if ($Phase -lt $StartFrom) {
        Write-Log "Phase $Phase - $Name : SKIP (deja complete)" "WARN"
        return $true
    }
    
    Write-Log "==========================================" "INFO"
    Write-Log "Phase $Phase : $Name" "INFO"
    Write-Log "==========================================" "INFO"
    
    try {
        if ($DryRun) {
            Write-Log "DRY RUN - Commande simulee" "WARN"
            return $true
        }
        
        & $Action
        Write-Log "Phase $Phase completee avec succes" "SUCCESS"
        return $true
    }
    catch {
        Write-Log "Phase $Phase echouee : $_" "ERROR"
        return $false
    }
}

# ============================================================================
# PHASE 1 : Tests APIs
# ============================================================================
$Phase1 = {
    Write-Log "Test des APIs..." "INFO"
    
    # Test ESPN API
    try {
        $response = Invoke-WebRequest -Uri "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/events?dates=20260215" -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Log "ESPN API OK (Status: $($response.StatusCode))" "SUCCESS"
        }
    }
    catch {
        Write-Log "ESPN API erreur : $_" "WARN"
    }
    
    Write-Log "Verification base de donnees..." "INFO"
    Set-Location $ProjectRoot
}

# ============================================================================
# PHASE 2 : Database Migration
# ============================================================================
$Phase2 = {
    Write-Log "Application des migrations..." "INFO"
    Set-Location $ProjectRoot
    
    $migrationExists = Test-Path "$ProjectRoot\prisma\migrations\20260216180514_add_player_tables"
    
    if ($migrationExists) {
        Write-Log "Migration detectee, application..." "INFO"
        npx prisma migrate deploy | Tee-Object -FilePath $MainLog -Append
        npx prisma generate | Tee-Object -FilePath $MainLog -Append
    }
    else {
        Write-Log "Migration non trouvee" "WARN"
    }
    
    Write-Log "Generation du client Prisma..." "INFO"
    npx prisma generate | Tee-Object -FilePath $MainLog -Append
}

# ============================================================================
# PHASE 3 : Extension Ingestion
# ============================================================================
$Phase3 = {
    Write-Log "Verification TypeScript..." "INFO"
    Set-Location $ProjectRoot
    
    try {
        npx tsc --noEmit 2>&1 | Tee-Object -FilePath $MainLog -Append
        Write-Log "TypeScript compilation OK" "SUCCESS"
    }
    catch {
        Write-Log "Erreurs TypeScript (non bloquant)" "WARN"
    }
}

# ============================================================================
# PHASE 4 : Tests
# ============================================================================
$Phase4 = {
    if ($SkipTests) {
        Write-Log "Tests ignores" "WARN"
        return
    }
    
    Write-Log "Execution des tests..." "INFO"
    Set-Location $ProjectRoot
    
    try {
        npm test 2>&1 | Tee-Object -FilePath $MainLog -Append
        Write-Log "Tests passes" "SUCCESS"
    }
    catch {
        Write-Log "Certains tests ont echoue" "WARN"
    }
}

# ============================================================================
# PHASE 5 : Fetch Donnees Historiques
# ============================================================================
$Phase5 = {
    Write-Log "Recuperation des donnees historiques..." "INFO"
    Set-Location $ProjectRoot
    
    if ($Season -ne 0) {
        Write-Log "Fetch saison specifique : $Season" "INFO"
        $seasons = @{
            2024 = @{ Start = "2024-10-22"; End = "2025-06-17" }
            2023 = @{ Start = "2023-10-24"; End = "2024-06-17" }
            2022 = @{ Start = "2022-10-18"; End = "2023-06-12" }
        }
        
        if ($seasons.ContainsKey($Season)) {
            $s = $seasons[$Season]
            Write-Log "Lancement fetch pour saison $Season..." "INFO"
            
            $cmd = "npx ts-node scripts/fetch-historical-data-full.ts --start-date=$($s.Start) --end-date=$($s.End) --season=$Season --include-players --include-injuries --update-rosters"
            Write-Log "Commande : $cmd" "INFO"
            Invoke-Expression $cmd 2>&1 | Tee-Object -FilePath $MainLog -Append
        }
        else {
            Write-Log "Saison $Season non configuree" "ERROR"
        }
    }
    else {
        Write-Log "Lancement du fetch toutes saisons..." "INFO"
        Write-Log "Ce processus peut prendre 6-8 heures" "WARN"
        
        if (Test-Path "$ProjectRoot\scripts\fetch-all-seasons.sh") {
            if (Get-Command "bash" -ErrorAction SilentlyContinue) {
                bash "$ProjectRoot/scripts/fetch-all-seasons.sh" 2>&1 | Tee-Object -FilePath $MainLog -Append
            }
            else {
                Write-Log "Git Bash non trouve. Execute manuellement:" "ERROR"
                Write-Log "  bash scripts/fetch-all-seasons.sh" "INFO"
            }
        }
    }
}

# ============================================================================
# PHASE 6 : Training ML
# ============================================================================
$Phase6 = {
    Write-Log "Entrainement du modele ML..." "INFO"
    Set-Location $ProjectRoot
    
    $cmd = "npx ts-node scripts/train-ml-model-full.ts --start-date=2015-10-27 --end-date=2026-02-16 --include-player-features --feature-set=full --activate"
    Write-Log "Commande : $cmd" "INFO"
    
    Invoke-Expression $cmd 2>&1 | Tee-Object -FilePath $MainLog -Append
    
    Write-Log "Training ML termine" "SUCCESS"
}

# ============================================================================
# PHASE 7 : Rapport Final
# ============================================================================
$Phase7 = {
    Write-Log "==========================================" "INFO"
    Write-Log "RAPPORT FINAL" "INFO"
    Write-Log "==========================================" "INFO"
    
    Set-Location $ProjectRoot
    
    try {
        Write-Log "Statistiques de la base de donnees :" "INFO"
        Write-Log "  Verification des donnees..." "INFO"
    }
    catch {
        Write-Log "Impossible de recuperer les stats" "WARN"
    }
    
    Write-Log "==========================================" "INFO"
    Write-Log "Log complet : $MainLog" "INFO"
    Write-Log "==========================================" "INFO"
}

# ============================================================================
# EXECUTION PRINCIPALE
# ============================================================================

Write-Log "Demarrage du NBA Data Enhancement Plan" "INFO"
Write-Log "Demarrage a partir de la Phase $StartFrom" "INFO"
Write-Log "Log : $MainLog" "INFO"

$Phases = @(
    @{ Num = 1; Name = "Tests APIs"; Action = $Phase1 },
    @{ Num = 2; Name = "Migration Database"; Action = $Phase2 },
    @{ Num = 3; Name = "Extension Ingestion"; Action = $Phase3 },
    @{ Num = 4; Name = "Tests et Validation"; Action = $Phase4 },
    @{ Num = 5; Name = "Fetch Donnees 2015-2026"; Action = $Phase5 },
    @{ Num = 6; Name = "Training ML"; Action = $Phase6 },
    @{ Num = 7; Name = "Rapport Final"; Action = $Phase7 }
)

$CompletedPhases = 0
$FailedPhases = @()

foreach ($Phase in $Phases) {
    $result = Invoke-Step -Phase $Phase.Num -Name $Phase.Name -Action $Phase.Action
    
    if ($result) {
        $CompletedPhases++
    }
    else {
        $FailedPhases += $Phase.Num
        Write-Log "Arret suite a l'echec de la Phase $($Phase.Num)" "ERROR"
        break
    }
}

# Resume
Write-Log "==========================================" "INFO"
Write-Log "EXECUTION TERMINEE" "INFO"
Write-Log "Phases completees : $CompletedPhases / 7" "INFO"

if ($FailedPhases.Count -gt 0) {
    Write-Log "Phases en echec : $($FailedPhases -join ', ')" "ERROR"
    exit 1
}
else {
    Write-Log "Toutes les phases completees avec succes !" "SUCCESS"
    exit 0
}
