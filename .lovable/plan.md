

# Cleanup Plan: Delete Ghost Duplicates from Demo Co #1

## Summary

Demo Co #1 (`d95f6df1-ef3c-4e12-8743-69c6bfb280bc`) contains ghost copies of CA Pro Builders data. All ghost records have `ghl_id IS NULL`. No formal foreign key constraints exist between tables, so deletion order is flexible but we will still go child-first for safety.

**What will be deleted (Demo Co #1 only):**

| Table | Ghost Count | Notes |
|-------|------------|-------|
| portal_chat_messages | 3 | Linked to ghost projects |
| client_portal_tokens | 36 | Linked to ghost projects |
| project_payments | 43 | Linked to ghost projects |
| project_invoices | 45 | Linked to ghost projects |
| project_bills | TBD | Linked to ghost projects |
| estimate_line_items | TBD | Linked to ghost estimates |
| estimates | 4 | Linked to ghost opportunities |
| projects | 36 | Linked to ghost opportunities |
| appointments | 17 | Linked to ghost contacts |
| opportunities | 1,175 | `ghl_id IS NULL` |
| contacts | 1,430 | `ghl_id IS NULL` |

**What will NOT be touched:**
- All CA Pro Builders records (different `company_id`)
- 4 real opportunities in Demo Co (have `ghl_id`)
- 16 real contacts in Demo Co (have `ghl_id`)
- 6 real projects in Demo Co (not linked to ghost opps)

## Implementation

A single SQL data operation that deletes in this order:

1. Delete `portal_chat_messages` linked to ghost projects
2. Delete `client_portal_tokens` linked to ghost projects
3. Delete `project_payments` linked to ghost projects
4. Delete `project_invoices` linked to ghost projects
5. Delete `project_bills` linked to ghost projects
6. Delete `bill_payments` linked to ghost bills (0 found, but included for safety)
7. Delete `estimate_line_items` linked to ghost estimates
8. Delete `estimates` linked to ghost opportunities
9. Delete `projects` linked to ghost opportunities
10. Delete `appointments` linked to ghost contacts
11. Delete `opportunities` where `company_id = Demo Co AND ghl_id IS NULL`
12. Delete `contacts` where `company_id = Demo Co AND ghl_id IS NULL`

All scoped exclusively to Demo Co #1's `company_id`. Zero risk to CA Pro Builders.

