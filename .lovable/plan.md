
# Plan: Fix ChatGPT AI Estimate Cost Interpretation

## Problem Identified

After switching from Lovable AI (Google Gemini) to your OpenAI API (ChatGPT), the AI is returning **total costs** instead of **per-unit costs** for `labor_cost` and `material_cost` fields.

### Example from Estimate 2053 (ChatGPT):
| Item | Quantity | Unit | AI Returned `material_cost` | Expected Per-Unit Cost | Result |
|------|----------|------|---------------------------|----------------------|--------|
| Lumber - Framing | 2,000 | board feet | $4,000 | ~$2/bf | $8,000,000 (wrong!) |
| Hardwood Flooring | 1,000 | sqft | $8,000 | ~$8/sqft | $8,000,000 (wrong!) |

### What's Happening:
1. ChatGPT calculates `2,000 board feet × $2/bf = $4,000` and returns `material_cost: 4000`
2. Frontend then calculates: `$4,000 × 2,000 = $8,000,000` (double-counting!)

### Estimate 2052 (Lovable AI / Gemini) worked because Gemini returned per-unit costs:
- Lumber: `material_cost: 2` (per board foot) → `$2 × 2,000 = $4,000` ✓

---

## Solution: Strengthen the Prompt for ChatGPT

Modify the `generate-estimate-scope` edge function to make the prompt **crystal clear** that costs must be **PER UNIT, not total**.

### Changes to `supabase/functions/generate-estimate-scope/index.ts`:

**1. Update the JSON schema example (line 202-213):**
```javascript
"items": [
  {
    "item_type": "labor|material|equipment|permit|assembly",
    "description": "SPECIFIC item description",
    "quantity": number,
    "unit": "hours|sqft|linear ft|each|set|LS",
    "labor_cost": number,  // PER-UNIT labor cost (e.g., $50/hour, NOT $500 for 10 hours)
    "material_cost": number,  // PER-UNIT material cost (e.g., $8/sqft, NOT $800 for 100 sqft)
    "markup_percent": number,
    "is_taxable": boolean,
    "notes": "string"
  }
]
```

**2. Add explicit clarification in the prompt:**
```
CRITICAL COST RULES:
- labor_cost = cost PER UNIT (e.g., $50 per hour, $3 per sqft)
- material_cost = cost PER UNIT (e.g., $8 per sqft, $2 per board foot)
- DO NOT multiply by quantity - return the UNIT RATE only
- The system will calculate: line_total = (labor_cost + material_cost) × quantity × (1 + markup)

EXAMPLE:
- 100 sqft of flooring at $8/sqft → material_cost: 8 (NOT 800)
- 20 hours of labor at $50/hour → labor_cost: 50 (NOT 1000)
```

**3. Add optional normalization logic (safety net):**
Add a heuristic check: if `(labor_cost + material_cost) > quantity × 100`, assume AI returned totals and divide by quantity.

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/generate-estimate-scope/index.ts` | Strengthen prompt with explicit per-unit cost examples and rules |

---

## Technical Implementation Details

### Updated Prompt Section (lines 191-235):
```text
Return a JSON object with this EXACT structure:
{
  "groups": [
    {
      "group_name": "Phase - Trade",
      "description": "Brief description",
      "items": [
        {
          "item_type": "labor|material|equipment|permit|assembly",
          "description": "Specific item description",
          "quantity": number,
          "unit": "hours|sqft|linear ft|each|set|LS",
          "labor_cost": number,
          "material_cost": number,
          "markup_percent": number,
          "is_taxable": boolean,
          "notes": "string"
        }
      ]
    }
  ]
}

**CRITICAL - COST FIELD RULES:**
- "labor_cost" = RATE PER UNIT (e.g., $50/hour, $3/sqft for install labor)
- "material_cost" = PRICE PER UNIT (e.g., $8/sqft, $2/board-foot)
- NEVER multiply costs by quantity - the system handles that
- The formula is: line_total = (labor_cost + material_cost) × quantity × (1 + markup%)

CORRECT EXAMPLES:
✓ 2000 board feet of lumber at $2/bf → quantity: 2000, material_cost: 2
✓ 40 hours of electrician at $75/hr → quantity: 40, labor_cost: 75
✓ 1000 sqft flooring at $8/sqft material + $3/sqft install → quantity: 1000, material_cost: 8, labor_cost: 3

WRONG EXAMPLES:
✗ material_cost: 4000 for 2000 board feet (this is total, not per-unit!)
✗ labor_cost: 3000 for 40 hours (should be 75 per hour)
```

---

## Expected Outcome

After this fix:
- **Estimate 2053 (if regenerated)**: Would show ~$936K instead of ~$17.8M
- **Future estimates**: ChatGPT will return proper per-unit costs
- **Backward compatible**: Lovable AI (Gemini) will continue to work correctly

---

## Risk Mitigation

As a safety net, we can also add normalization logic in the frontend to detect and correct this issue:

```typescript
// In EstimateBuilderDialog.tsx, when processing AI response:
let laborCost = parseNum(item.labor_cost);
let materialCost = parseNum(item.material_cost);
const quantity = item.quantity || 1;

// Heuristic: if combined cost seems like a total (> $500/unit for most items), normalize
const combinedCost = laborCost + materialCost;
if (combinedCost > 500 && quantity > 1) {
  // AI likely returned totals instead of per-unit
  laborCost = laborCost / quantity;
  materialCost = materialCost / quantity;
  console.warn(`Normalized costs for "${item.description}" (likely AI returned totals)`);
}
```

This provides a fallback in case the prompt fix alone doesn't fully solve the issue.
