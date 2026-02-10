

## Fix: Admin Settings Card 404

**Problem**: The "Admin Settings" card on the Home page navigates to `/admin`, but the route is defined as `/admin/settings`. No `/admin` route exists, resulting in a 404.

**Solution**: Update the card's `path` in `src/pages/Home.tsx` from `"/admin"` to `"/admin/settings"`.

### Technical Details

**File: `src/pages/Home.tsx`**
- Change the `path` property of the "Admin Settings" quick access item from `"/admin"` to `"/admin/settings"`

This is a one-line fix with no other side effects.

