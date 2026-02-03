
# Preventive Fix: Ensure Bills Are Properly Tagged to Customers in QuickBooks

## Problem Summary

Bills created in QuickBooks aren't always tagged with a `CustomerRef` (for job costing), which causes them to not appear when filtering by project. This happens because:

1. The bill creation logic only looks for **contact-based customer mappings** (`mapping_type: 'customer'`)
2. It ignores the newer **project-to-customer mappings** (`mapping_type: 'project_customer'`)
3. Projects without a linked contact (`contact_uuid`) can't have their bills tagged at all

## Solution

Update the bill sync logic to also check for `project_customer` mappings when determining the `CustomerRef` to attach to bill line items.

---

## Technical Implementation

### File: `supabase/functions/sync-to-quickbooks/index.ts`

**Current Logic (lines 865-883):**
```
Only checks: mapping_type === "customer" with source_value matching contact_uuid or contact_id
```

**Updated Logic:**
```
1. First check: mapping_type === "project_customer" with source_value matching project.id
2. Fallback: mapping_type === "customer" with source_value matching contact_uuid or contact_id
```

### Code Changes

Around line 865, update the customer mapping lookup for bills:

```typescript
// Look up customer mapping for job costing (link bill to project)
let customerRef: { value: string; name?: string } | undefined;
const projectId = bill.projects?.id;
const contactUuid = bill.projects?.contact_uuid;
const contactGhlId = bill.projects?.contact_id;

// Priority 1: Check for direct project_customer mapping
if (projectId) {
  const projectMapping = mappings?.find(m => 
    m.mapping_type === "project_customer" && 
    m.source_value === projectId
  );
  
  if (projectMapping && projectMapping.qbo_id) {
    customerRef = { 
      value: projectMapping.qbo_id, 
      name: projectMapping.qbo_name || undefined 
    };
    console.log(`Found project_customer mapping for bill job costing:`, customerRef);
  }
}

// Priority 2: Fall back to contact-based customer mapping
if (!customerRef && (contactUuid || contactGhlId)) {
  const contactMapping = mappings?.find(m => 
    m.mapping_type === "customer" && 
    (m.source_value === contactUuid || m.source_value === contactGhlId)
  );
  
  if (contactMapping && contactMapping.qbo_id) {
    customerRef = { 
      value: contactMapping.qbo_id, 
      name: contactMapping.qbo_name || undefined 
    };
    console.log(`Found contact customer mapping for bill job costing:`, customerRef);
  }
}
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/sync-to-quickbooks/index.ts` | Add `project_customer` mapping lookup before contact-based lookup when setting CustomerRef on bills |

## Expected Outcome

After this fix:
- Bills created for projects with a `project_customer` mapping will automatically be tagged to the correct QuickBooks customer
- The bill selection dialog will find these bills when filtering by project
- Existing contact-based mappings continue to work as a fallback
- No more "missing bill" issues for properly mapped projects

## Recommendation: UI Warning

Additionally, consider adding a warning in the bill creation UI when:
- The project has no QuickBooks customer mapping (neither `project_customer` nor `customer`)
- This would alert users upfront that the bill won't be job-costed in QuickBooks
