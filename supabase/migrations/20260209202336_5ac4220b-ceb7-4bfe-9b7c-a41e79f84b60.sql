
-- Backfill EST 2106: Add "Materials Delivered" at 15%, redistribute remaining 85% among existing group phases
-- Current: Phase 1 (8%), Phase 2 (47%), Phase 3 (35%), Phase 4 (10%) = 100%
-- New: Materials Delivered (15%), Phase 1 (7%), Phase 2 (40%), Phase 3 (28%), Phase 4 (10%) = 100%

-- Delete existing non-deposit phases
DELETE FROM estimate_payment_schedule 
WHERE estimate_id = 'd7b007d5-1cc4-4940-aaa2-6b9522e08e4a' 
AND phase_name != 'Deposit';

-- Re-insert with Materials Delivered first, then group phases (85% total)
-- Remaining after $1,000 deposit = $9,900
INSERT INTO estimate_payment_schedule (estimate_id, phase_name, percent, amount, due_type, description, sort_order)
VALUES
  ('d7b007d5-1cc4-4940-aaa2-6b9522e08e4a', 'Materials Delivered', 15, 1485, 'milestone', 'Upon delivery of materials to job site', 1),
  ('d7b007d5-1cc4-4940-aaa2-6b9522e08e4a', 'Phase 1 - Mobilization & Protection', 7, 693, 'milestone', 'Site prep, protection of existing surfaces', 2),
  ('d7b007d5-1cc4-4940-aaa2-6b9522e08e4a', 'Phase 2 - Aluminum Enclosure Framing & Panels', 40, 3960, 'milestone', 'Upon delivery of materials and start of framing', 3),
  ('d7b007d5-1cc4-4940-aaa2-6b9522e08e4a', 'Phase 3 - Garage Door & Opener Install', 28, 2772, 'milestone', 'Upon completion of door and opener installation', 4),
  ('d7b007d5-1cc4-4940-aaa2-6b9522e08e4a', 'Phase 4 - Cleanup & Haul Away', 10, 990, 'milestone', 'After testing, adjustments, and final cleanup', 5);
