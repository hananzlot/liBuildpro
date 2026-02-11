
-- Delete existing payment schedule for estimate 2107
DELETE FROM estimate_payment_schedule 
WHERE estimate_id = '44fcac52-fefb-49be-b98d-735a3220c241';

-- Rebuild payment schedule from groups following business rules:
-- 1. Deposit (fixed $1000)
-- 2. Materials Delivered (15% of remaining)
-- 3. Each group proportional to 85% of remaining
-- 4. Final phase minimum 10%

DO $$
DECLARE
  v_estimate_id UUID := '44fcac52-fefb-49be-b98d-735a3220c241';
  v_company_id UUID := '8aeba63a-3947-4aeb-8359-dceb5e47773e';
  v_deposit NUMERIC := 1000;
  v_grand_total NUMERIC;
  v_remaining NUMERIC;
  v_sort INT := 0;
  v_group RECORD;
  v_pct NUMERIC;
  v_total_group_pct NUMERIC := 0;
  v_phases_count INT := 0;
  v_last_phase_id UUID;
  v_last_pct NUMERIC;
  v_largest_phase_id UUID;
  v_largest_pct NUMERIC := 0;
BEGIN
  -- Get grand total from line items
  SELECT COALESCE(SUM(li.line_total), 0) INTO v_grand_total
  FROM estimate_line_items li
  WHERE li.estimate_id = v_estimate_id;

  v_remaining := v_grand_total - v_deposit;

  -- Insert Deposit phase
  INSERT INTO estimate_payment_schedule (estimate_id, phase_name, percent, amount, due_type, description, sort_order, company_id)
  VALUES (v_estimate_id, 'Deposit', 0, v_deposit, 'on_approval', 'Due upon contract signing', v_sort, v_company_id);
  v_sort := v_sort + 1;

  -- Insert Materials Delivered phase (15%)
  INSERT INTO estimate_payment_schedule (estimate_id, phase_name, percent, amount, due_type, description, sort_order, company_id)
  VALUES (v_estimate_id, 'Materials Delivered', 15, v_remaining * 0.15, 'milestone', 'Upon delivery of materials to job site', v_sort, v_company_id);
  v_sort := v_sort + 1;

  -- Insert group-based phases (85% distributed proportionally)
  FOR v_group IN 
    SELECT g.group_name, SUM(li.line_total) as group_total
    FROM estimate_groups g
    JOIN estimate_line_items li ON li.group_id = g.id
    WHERE g.estimate_id = v_estimate_id
    GROUP BY g.group_name, g.sort_order
    ORDER BY g.sort_order
  LOOP
    v_pct := ROUND((v_group.group_total / v_grand_total) * 85, 0);
    v_total_group_pct := v_total_group_pct + v_pct;
    v_phases_count := v_phases_count + 1;

    INSERT INTO estimate_payment_schedule (estimate_id, phase_name, percent, amount, due_type, description, sort_order, company_id)
    VALUES (v_estimate_id, v_group.group_name, v_pct, v_remaining * v_pct / 100, 'milestone', '', v_sort, v_company_id)
    RETURNING id INTO v_last_phase_id;

    v_last_pct := v_pct;
    
    IF v_pct > v_largest_pct AND v_phases_count < 15 THEN
      v_largest_pct := v_pct;
      v_largest_phase_id := v_last_phase_id;
    END IF;

    v_sort := v_sort + 1;
  END LOOP;

  -- Normalize: group phases should sum to 85%
  IF v_total_group_pct != 85 THEN
    UPDATE estimate_payment_schedule
    SET percent = percent + (85 - v_total_group_pct),
        amount = v_remaining * (percent + (85 - v_total_group_pct)) / 100
    WHERE id = (SELECT id FROM estimate_payment_schedule WHERE estimate_id = v_estimate_id ORDER BY sort_order LIMIT 1 OFFSET 2);
  END IF;

  -- Ensure final phase is at least 10%
  IF v_last_pct < 10 AND v_phases_count > 1 THEN
    DECLARE
      v_deficit NUMERIC := 10 - v_last_pct;
    BEGIN
      -- Bump last phase to 10%
      UPDATE estimate_payment_schedule
      SET percent = 10, amount = v_remaining * 0.10
      WHERE id = v_last_phase_id;

      -- Take deficit from largest non-final phase
      UPDATE estimate_payment_schedule
      SET percent = percent - v_deficit,
          amount = v_remaining * (percent - v_deficit) / 100
      WHERE id = v_largest_phase_id;
    END;
  END IF;
END $$;
