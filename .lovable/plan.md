

## Plan: Safe-delete Demo Co projects #77 and #88 with linked opportunities

### What will be deleted (database records only)

**Project #77** (`68369843-12a1-427b-b8d4-1443f3d8e80c`):
- 1 `project_documents` record (`dce29d13`) -- DB row only, storage file shared with CA Pro Builders
- 1 `project_agreements` record (`76300249`) -- DB row only, storage file shared with CA Pro Builders
- 1 `client_portal_tokens` record (if any)
- The project record itself
- Opportunity `bf99f7c6-2aa0-45f8-8d17-df0c4745447c`

**Project #88** (`0f397d38-6aed-4db2-aa41-468757423570`):
- 1 `client_portal_tokens` record
- The project record itself
- Opportunity `5501390f-736e-4ad1-9ea0-93288fce0778`

No storage files will be deleted (the PDFs are shared with CA Pro Builders project #54).

### Implementation

Single data operation using the insert/update/delete tool, executed in dependency order:

1. Delete `project_documents` where `project_id = '68369843...'`
2. Delete `project_agreements` where `project_id = '68369843...'`
3. Delete `client_portal_tokens` where `project_id` in both projects
4. Delete `project_activity_notes` (if any) for both projects
5. Nullify `opportunity_uuid` on both projects (to avoid FK constraint), then delete the projects
6. Delete both opportunities (`bf99f7c6`, `5501390f`)

All in a single SQL transaction to ensure consistency.

