

## Fix: Default audit log date filters to today

The `startDate` and `endDate` state variables in `AdminSettings.tsx` (line 142-143) are initialized as empty strings. They should default to today's date.

### Implementation

**File: `src/pages/AdminSettings.tsx`**

Replace:
```ts
const [startDate, setStartDate] = useState("");
const [endDate, setEndDate] = useState("");
```

With:
```ts
const today = new Date().toISOString().split("T")[0];
const [startDate, setStartDate] = useState(today);
const [endDate, setEndDate] = useState(today);
```

This matches the documented behavior where audit log filters default to "Today" to immediately show recent activity.

