-- Add default terms and conditions setting
INSERT INTO public.app_settings (setting_key, setting_value, setting_type, description)
VALUES (
  'default_terms_and_conditions',
  'TERMS AND CONDITIONS

1. SCOPE OF WORK: Work shall be performed as described in this estimate only. Any additional work requires a separate written agreement.

2. PAYMENT TERMS: Deposits are due upon acceptance. Progress payments are due within 3 business days of milestone completion. Final payment is due upon project completion.

3. PERMITS: Client is responsible for obtaining necessary permits unless otherwise specified. Permit fees are not included unless listed.

4. CHANGES: Any changes to scope must be agreed in writing. Changes may affect project timeline and cost.

5. WARRANTY: Labor is warranted for 1 year from completion date. Material warranties are per manufacturer specifications.

6. LIABILITY: Contractor maintains general liability insurance. Client is responsible for insuring personal property.

7. ACCESS: Client shall provide reasonable access to work areas. Delays caused by access issues may extend timeline.

8. CANCELLATION: Deposits are non-refundable if work has begun or materials ordered. 

9. ACCEPTANCE: This estimate is valid for 30 days from issue date. Acceptance constitutes agreement to these terms.',
  'text',
  'Default terms and conditions for new estimates'
) ON CONFLICT (setting_key) DO NOTHING;