const { query } = require('../config/database');

/**
 * DONOR ENGINE (Agent 3)
 * Automatically matches donor drives based on model, firmware, PCB compatibility
 */

async function findDonors(storageModelId, options = {}) {
  const { limit = 10, minScore = 30 } = options;

  // Get the target model's details
  const modelResult = await query(
    `SELECT sm.*, sb.name as brand_name 
     FROM storage_models sm
     JOIN storage_brands sb ON sm.brand_id = sb.id
     WHERE sm.id = $1`,
    [storageModelId]
  );

  if (!modelResult.rows.length) {
    return { donors: [], total: 0 };
  }

  const targetModel = modelResult.rows[0];

  // Find donors from database donor_matching table
  const dbDonors = await query(
    `SELECT dm.*, 
            sm.model_number, sm.series, sm.capacity_gb, sm.controller_chip,
            sm.pcb_number, sm.firmware_family, sm.head_map, sm.platter_count,
            sb.name as brand_name,
            ii.id as inventory_id, ii.quantity as stock_qty, ii.condition,
            ii.serial_number as donor_serial, ii.firmware_version as donor_firmware
     FROM donor_matching dm
     JOIN storage_models sm ON dm.donor_model_id = sm.id
     JOIN storage_brands sb ON sm.brand_id = sb.id
     LEFT JOIN inventory_items ii ON ii.storage_model_id = sm.id 
          AND ii.category = 'donor_drive' AND ii.is_available = true
     WHERE dm.model_id = $1 AND dm.compatibility_score >= $2
     ORDER BY dm.compatibility_score DESC, ii.quantity DESC NULLS LAST
     LIMIT $3`,
    [storageModelId, minScore, limit]
  );

  // Also find inventory donors by matching specs directly
  const inventoryDonors = await query(
    `SELECT ii.*, sm.model_number, sm.series, sm.capacity_gb, 
            sm.controller_chip, sm.pcb_number, sm.firmware_family,
            sm.head_map, sm.platter_count, sb.name as brand_name,
            NULL::decimal as compatibility_score
     FROM inventory_items ii
     JOIN storage_models sm ON ii.storage_model_id = sm.id
     JOIN storage_brands sb ON sm.brand_id = sb.id
     WHERE ii.category = 'donor_drive' 
       AND ii.is_available = true
       AND sm.brand_id = $1
       AND (
         sm.capacity_gb = $2 OR
         sm.pcb_number = $3 OR
         sm.firmware_family = $4
       )
     ORDER BY 
       (CASE WHEN sm.model_number = $5 THEN 100 ELSE 0 END) +
       (CASE WHEN sm.pcb_number = $3 THEN 40 ELSE 0 END) +
       (CASE WHEN sm.firmware_family = $4 THEN 30 ELSE 0 END) +
       (CASE WHEN sm.capacity_gb = $2 THEN 20 ELSE 0 END) DESC
     LIMIT $6`,
    [
      targetModel.brand_id,
      targetModel.capacity_gb,
      targetModel.pcb_number,
      targetModel.firmware_family,
      targetModel.model_number,
      limit
    ]
  );

  // Score and merge results
  const donorMap = new Map();

  // Add DB-matched donors
  for (const d of dbDonors.rows) {
    donorMap.set(d.donor_model_id || d.id, {
      ...d,
      matchType: 'database_matched',
      inStock: (d.stock_qty || 0) > 0,
    });
  }

  // Add inventory candidates not already in map
  for (const d of inventoryDonors.rows) {
    const key = d.storage_model_id;
    if (!donorMap.has(key)) {
      const score = calculateCompatibilityScore(targetModel, d);
      donorMap.set(key, {
        ...d,
        compatibility_score: score,
        matchType: 'auto_matched',
        inStock: d.quantity > 0,
      });
    }
  }

  const donors = Array.from(donorMap.values())
    .filter(d => d.compatibility_score >= minScore)
    .sort((a, b) => {
      // Prioritize in-stock, then highest score
      if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
      return b.compatibility_score - a.compatibility_score;
    });

  return {
    targetModel,
    donors: donors.slice(0, limit),
    total: donors.length,
  };
}

function calculateCompatibilityScore(target, candidate) {
  let score = 0;

  if (target.model_number === candidate.model_number) score += 100;
  else if (target.series && candidate.series && target.series === candidate.series) score += 60;

  if (target.pcb_number && candidate.pcb_number && target.pcb_number === candidate.pcb_number) score += 40;
  if (target.firmware_family && candidate.firmware_family && target.firmware_family === candidate.firmware_family) score += 30;
  if (target.controller_chip && candidate.controller_chip && target.controller_chip === candidate.controller_chip) score += 20;
  if (target.capacity_gb === candidate.capacity_gb) score += 20;
  if (target.platter_count && candidate.platter_count && target.platter_count === candidate.platter_count) score += 15;
  if (target.head_map && candidate.head_map && target.head_map === candidate.head_map) score += 25;

  return Math.min(score, 100);
}

async function reserveDonorForCase(inventoryItemId, caseId, userId) {
  await query(
    `UPDATE inventory_items SET 
       is_available = false, 
       reserved_for_case = $1,
       updated_at = NOW()
     WHERE id = $2`,
    [caseId, inventoryItemId]
  );

  await query(
    `INSERT INTO inventory_transactions (item_id, case_id, type, quantity, notes, performed_by)
     VALUES ($1, $2, 'reserved', 1, 'Reserved as donor for case', $3)`,
    [inventoryItemId, caseId, userId]
  );
}

module.exports = { findDonors, calculateCompatibilityScore, reserveDonorForCase };
