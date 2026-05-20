const { query } = require('../config/database');

/**
 * SMART ASSIST ENGINE (Agent 3)
 * Input: model + symptoms → Output: failure prediction, recovery steps, risk level
 */

// Failure patterns knowledge base
const FAILURE_PATTERNS = {
  'WD': {
    symptoms: {
      'slow': {
        failureType: 'firmware',
        riskLevel: 'high',
        strategy: 'WD Slow Issue - Firmware Level Fix',
        steps: [
          'DO NOT attempt surface scan - will make it worse',
          'Connect via PC-3000 or MRT',
          'Check ROM status and firmware modules',
          'Use "Slow drive" utility in PC-3000',
          'May need ARCO module repair',
          'Use ddrescue with reverse pass after stabilization',
        ],
        warning: 'WD slow drives are classic ROM/firmware issue. Every read accelerates degradation. Image FIRST.',
      },
      'clicking': {
        failureType: 'mechanical',
        riskLevel: 'critical',
        strategy: 'WD Head Replacement',
        steps: [
          'Power OFF immediately - do NOT spin again before assessment',
          'Document click pattern (1-click vs rhythmic vs random)',
          'Check model for head count and map',
          'Source donor with matching PCB and head stack revision',
          'Perform head swap in clean room / laminar flow bench',
          'After swap: image at lowest speed with skipping bad sectors',
        ],
        warning: 'Each power cycle in a head-failed drive causes platter scoring. CRITICAL priority.',
      },
      'not_detected': {
        failureType: 'electrical',
        riskLevel: 'high',
        strategy: 'PCB Swap / ROM Transfer',
        steps: [
          'Check USB-SATA adapter if applicable',
          'Inspect PCB for burnt components (TVS diode check)',
          'Check motor controller IC for shorts',
          'Source matching PCB - same board number AND firmware',
          'Transfer ROM chip from original to donor PCB',
          'Test with PC-3000 before data extraction',
        ],
      },
    }
  },
  'Seagate': {
    symptoms: {
      'not_detected': {
        failureType: 'firmware',
        riskLevel: 'high',
        strategy: 'Seagate BSY/LBA0 Firmware Fix',
        steps: [
          'Check if drive responds to terminal (RS-232 via PCB pads)',
          'Attempt BSY fix via serial terminal: Ctrl+Z, m0,2,2,0,0,0,0,22',
          'If BSY: /2 → LED:000000CC → FAddr:0024A051 pattern',
          'For CC firmware: use specific BSY bypass procedure',
          'After fix: immediately image to another drive',
          'Do NOT run vendor diagnostics',
        ],
        warning: 'Classic Seagate 7200.11 BSY bug. Check firmware version first.',
      },
      'slow': {
        failureType: 'mechanical',
        riskLevel: 'medium',
        strategy: 'Seagate Slow Drive - Head Assessment',
        steps: [
          'Check SMART for reallocated sectors and pending sectors',
          'Run PC-3000 head test to identify failing heads',
          'If 1-2 heads failing: image with those heads disabled',
          'Use ddrescue with -n first pass, then -r 3 for retries',
        ],
      },
    }
  },
  'Toshiba': {
    symptoms: {
      'not_detected': {
        failureType: 'firmware',
        riskLevel: 'medium',
        strategy: 'Toshiba Firmware Recovery',
        steps: [
          'Check ROM integrity via PC-3000',
          'Identify translator damage vs SA zone corruption',
          'Use MRT or PC-3000 Toshiba module',
          'Rebuild translator if intact SA zone found',
        ],
      },
    }
  }
};

// Recovery strategy templates
const RECOVERY_STRATEGIES = {
  logical: {
    riskLevel: 'low',
    avgSuccessRate: 95,
    steps: ['Run file system check', 'Use R-Studio or PhotoRec for partition recovery', 'Check MFT/MBR integrity', 'Rebuild partition table if needed'],
  },
  firmware: {
    riskLevel: 'high',
    avgSuccessRate: 75,
    steps: ['Connect to PC-3000', 'Read ROM', 'Diagnose firmware zone', 'Repair firmware modules', 'Image drive'],
  },
  electrical: {
    riskLevel: 'medium',
    avgSuccessRate: 80,
    steps: ['Inspect PCB', 'Check TVS diode', 'Source matching PCB', 'Transfer ROM', 'Test'],
  },
  mechanical: {
    riskLevel: 'critical',
    avgSuccessRate: 60,
    steps: ['Assess click pattern', 'Clean room required', 'Source donor drive', 'Head/platter swap', 'Immediate imaging'],
  },
};

async function analyzeCase({ brandName, modelNumber, symptoms, failureType }) {
  const result = {
    suggestedFailureType: failureType || 'unknown',
    riskLevel: 'medium',
    confidence: 50,
    strategy: null,
    steps: [],
    warnings: [],
    donorRequired: false,
    cleanRoomRequired: false,
  };

  // Check brand-specific patterns
  const brandPatterns = FAILURE_PATTERNS[brandName];
  if (brandPatterns) {
    for (const symptom of (symptoms || [])) {
      const pattern = brandPatterns.symptoms[symptom];
      if (pattern) {
        result.suggestedFailureType = pattern.failureType;
        result.riskLevel = pattern.riskLevel;
        result.strategy = pattern.strategy;
        result.steps = pattern.steps;
        if (pattern.warning) result.warnings.push(pattern.warning);
        result.confidence = 85;
        break;
      }
    }
  }

  // Use failure type strategy if no brand-specific match
  if (!result.strategy && failureType && RECOVERY_STRATEGIES[failureType]) {
    const strat = RECOVERY_STRATEGIES[failureType];
    result.riskLevel = strat.riskLevel;
    result.steps = strat.steps;
    result.confidence = 65;
  }

  // Check model-specific data from database
  if (modelNumber) {
    try {
      const modelData = await query(
        `SELECT sm.risk_level, sm.common_failures, sm.recovery_strategy, sm.known_issues,
                sm.do_notes, sm.dont_notes, sm.platter_count, sm.head_map
         FROM storage_models sm
         JOIN storage_brands sb ON sm.brand_id = sb.id
         WHERE sm.model_number ILIKE $1 OR sm.model_number ILIKE $2
         LIMIT 1`,
        [modelNumber, `%${modelNumber}%`]
      );

      if (modelData.rows.length > 0) {
        const model = modelData.rows[0];
        result.modelData = model;
        if (model.risk_level) result.riskLevel = model.risk_level;
        if (model.recovery_strategy) {
          result.dbStrategy = model.recovery_strategy;
          result.confidence = Math.min(result.confidence + 20, 95);
        }
        if (model.known_issues) result.knownIssues = model.known_issues;
        if (model.do_notes) result.doNotes = model.do_notes;
        if (model.dont_notes) result.dontNotes = model.dont_notes;
      }
    } catch (err) {
      // Non-fatal: DB lookup failed
    }
  }

  // Mechanical checks
  if (result.suggestedFailureType === 'mechanical' || (symptoms || []).includes('clicking')) {
    result.cleanRoomRequired = true;
    result.donorRequired = true;
    result.riskLevel = 'critical';
  }

  if ((symptoms || []).includes('not_detected') || result.suggestedFailureType === 'electrical') {
    result.donorRequired = true;
  }

  return result;
}

module.exports = { analyzeCase };
