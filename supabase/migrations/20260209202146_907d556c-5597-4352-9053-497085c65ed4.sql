
-- Backfill EST 2106: Replace non-deposit payment phases with group-based phases
-- Groups: Phase 1 (8%), Phase 2 (47%), Phase 3 (35%), Phase 4 (10%) = 100%
-- Remaining after $1,000 deposit = $9,900

DELETE FROM estimate_payment_schedule 
WHERE estimate_id = 'd7b007d5-1cc4-4940-aaa2-6b9522e08e4a' 
AND phase_name != 'Deposit';

INSERT INTO estimate_payment_schedule (estimate_id, phase_name, percent, amount, due_type, description, sort_order)
VALUES
  ('d7b007d5-1cc4-4940-aaa2-6b9522e08e4a', 'Phase 1 - Mobilization & Protection', 8, 792, 'milestone', 'Site prep, protection of existing surfaces', 1),
  ('d7b007d5-1cc4-4940-aaa2-6b9522e08e4a', 'Phase 2 - Aluminum Enclosure Framing & Panels', 47, 4653, 'milestone', 'Upon delivery of materials and start of framing', 2),
  ('d7b007d5-1cc4-4940-aaa2-6b9522e08e4a', 'Phase 3 - Garage Door & Opener Install', 35, 3465, 'milestone', 'Upon completion of door and opener installation', 3),
  ('d7b007d5-1cc4-4940-aaa2-6b9522e08e4a', 'Phase 4 - Cleanup & Haul Away', 10, 990, 'milestone', 'After testing, adjustments, and final cleanup', 4);
