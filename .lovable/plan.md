

## Add Debug Button to Contact Detail Sheet

**What**: Add the same "Debug" button (super admin only) to the Contact Detail Sheet header, matching the pattern used in the Opportunity Detail Sheet. It will copy the contact's key IDs to the clipboard.

**Where**: `src/components/dashboard/ContactDetailSheet.tsx`, in the header area (around line 601), alongside the existing action buttons.

**Changes**:

1. **Import `Copy` icon** from lucide-react (if not already imported)
2. **Destructure `isSuperAdmin`** from `useAuth()` (line 261 — currently only destructures `isAdmin, user, companyId`)
3. **Add Debug button** in the header actions div (line 601), before the "Create Opportunity" button:

```tsx
{isSuperAdmin && (
  <Button
    variant="ghost"
    size="sm"
    className="h-7 px-2 text-muted-foreground"
    onClick={() => {
      const debugInfo = `UUID: ${localContact.id}\nGHL ID: ${localContact.ghl_id}\nEmail: ${localContact.email}\nPhone: ${localContact.phone}\nAssigned To: ${localContact.assigned_to}`;
      navigator.clipboard.writeText(debugInfo);
      toast({ title: "Debug info copied to clipboard" });
    }}
  >
    <Copy className="h-3.5 w-3.5 mr-1" />
    Debug
  </Button>
)}
```

**Debug info copied**: UUID, GHL ID, email, phone, and assigned_to — the key identifiers needed to trace mapping issues like the conversation backfill.

