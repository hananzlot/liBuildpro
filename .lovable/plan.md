

## Plan: Add Payment Method (Zelle/ACH/Wire) to Payment Received Form

### Database Change
- Add `payment_method` column (text, nullable) to `project_payments` table via migration

### UI Changes in `src/components/production/FinanceSection.tsx`

1. **Payment interface** (~line 131): Add `payment_method: string | null` field

2. **PaymentDialog form state** (~line 3903): Add `payment_method: ""` to formData

3. **Form initialization** (~line 3968): Load `payment_method` from existing payment when editing

4. **Form UI** (~line 4178, between Fee and Check # row): Add a Select dropdown for Payment Method with options: `Check`, `Zelle/ACH`, `Wire`. When `Zelle/ACH` or `Wire` is selected, disable the Check # input field and clear its value.

5. **handleSubmit** (~line 4037): Include `payment_method` in the saved data

6. **Payment query select** (wherever payments are fetched): Add `payment_method` to the select fields

### Display Changes
- Show payment method in payment table rows where payments are listed
- Update `PendingDeposits.tsx` and `PendingDepositsSheet.tsx` to fetch and display `payment_method`

### Technical Details
- Migration SQL: `ALTER TABLE project_payments ADD COLUMN payment_method text;`
- When `payment_method` is `Zelle/ACH` or `Wire`, the Check # input is disabled and cleared
- Default behavior: if no method selected, Check # remains enabled (backward compatible)

