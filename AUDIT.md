# StuffKeep audit (Oct 15 2026)
## Findings
1. [MED] Values typed with a comma decimal are stored 100x too high and inflate the insurance total
   - Where: src/money.ts:8 (strips every comma), src/screens/ItemForm.tsx:288 (`keyboardType="decimal-pad"`)
   - What happens: on an iPhone whose region uses a comma decimal (Germany, France, Spain, Italy, Brazil, and many others, including US users with such a region setting), the iOS decimal pad shows "," instead of ".". The user types `1299,99` for a TV, `parseDollarsToCents` removes the comma, and the item is saved as $129,999. The Home hero total, the room totals, the PDF "Total documented value" and the CSV all show the inflated number.
   - Fix: in `parseDollarsToCents`, when the input contains a comma and no period, and the comma is followed by exactly 1 or 2 digits at the end, treat the comma as the decimal point. Otherwise keep stripping commas as thousands separators. (Alternatively, read the locale's decimal separator with expo-localization and normalize it.)

2. [MED] Face ID lock wipes an in-progress Add/Edit item form, and new photos are left as orphan files
   - Where: src/LockGate.tsx:42-44 and src/LockGate.tsx:53 (replaces `children` while locked), src/screens/ItemForm.tsx:70-88 (`reset()` on remount for a new item; reload from the database for an edit)
   - What happens: a Pro user with the lock on is adding an item, has taken 3 photos and typed a name, and switches to Mail or Safari to look up the price or receipt. On 'background', LockGate unmounts the tree, including the ItemForm modal. After Face ID, the modal reopens empty: the typed fields and the `pendingPhotos` list are lost. The 3 JPEGs stay in Documents/photos with no database row, so they are never cleaned up and still take up space and backup size. Unsaved edits to an existing item are lost the same way.
   - Fix: keep `children` mounted and render the lock screen as an absolute-fill overlay on top of it.

3. [MED] Tapping the photo ✕ permanently deletes the photo right away, and Cancel does not bring it back
   - Where: src/screens/ItemForm.tsx:129-136 (`deletePhoto` plus `deletePhotoFile` on tap), src/screens/ItemForm.tsx:241-246 (22pt ✕ with hitSlop 8, no confirmation), src/screens/ItemForm.tsx:204-210 (Cancel only cleans up pending photos)
   - What happens: while editing an item, the user brushes the small red ✕ on the receipt or serial-plate photo. The database row and the JPEG are deleted immediately. Tapping Cancel ("discard changes") does not restore it, so the insurance proof is gone.
   - Fix: show a confirmation Alert before `removePhoto` when editing, or collect removals in state and apply them only on Save.

4. [MED] Pro status is read only once at launch: there is no CustomerInfo listener and no refresh on foreground
   - Where: src/state.tsx:61-66 (single `getIsPro()`), src/state.tsx:84-86 (`refreshPro` is never called)
   - What happens: a purchase that does not go through the in-app paywall (offer or promo code redeemed in the App Store, Ask to Buy approval, a late-arriving transaction, recovery from a billing retry) leaves the user on the free tier, capped at 30 items and 1 photo with no PDF, until they kill the app or tap Restore. A lapsed weekly trial keeps Pro while the app stays resident.
   - Fix: after `initPurchases()`, when billing is available, add `Purchases.addCustomerInfoUpdateListener(info => setIsPro(isProFromCustomerInfo(info)))`. Also call `refreshPro()` on AppState 'active'.

5. [LOW] PDF and CSV silently drop items beyond 1000 while the total still counts them
   - Where: src/db.ts:185 (`LIMIT 1000` in `getItems`, used by `getItemsGroupedByRoom` and `exportCsv`), src/report.ts:61 vs src/report.ts:91 (room totals are built from the capped list, the grand total from `getTotals()`, which is uncapped)
   - What happens: a thorough Pro user with 1,050 items exports the claim report. The 50 least recently edited items are missing from the PDF and CSV, and the room totals do not add up to the "Total documented value" in the header.
   - Fix: add an `{ all: true }` option (or a separate query with no LIMIT) and use it for the report and CSV export.

6. [LOW] CSV "added" date is in UTC, so evening entries show the next day
   - Where: src/db.ts:281 (`new Date(it.createdAt).toISOString().slice(0, 10)`)
   - What happens: an item added at 8pm Eastern on Oct 14 is exported as 2026-10-15.
   - Fix: format the date from local getters (getFullYear, getMonth + 1, getDate), as OneLine's `toDayKey` does.

7. [LOW] Face ID lock has two dead ends: a lapsed subscriber cannot turn it off, and a removed passcode locks the user out
   - Where: src/screens/Settings.tsx:29-33 (Pro is required to toggle in either direction), src/LockGate.tsx:19-30 (`res.error` is ignored)
   - What happens: (a) after the subscription lapses, turning the lock off opens the paywall. (b) If the user removes their device passcode, `authenticateAsync` returns `passcode_not_set` on every attempt and the inventory cannot be opened, with no explanation.
   - Fix: only require Pro when turning the lock on. Handle 'passcode_not_set', 'not_enrolled' and 'not_available' with an explanatory alert or by unlocking.

## Checked and fine
- photos.ts: the database stores only filenames (true since v1.0, verified in git), and `photoUri` rebuilds the path from the current documentDirectory, so container UUID changes on update do not break photos. The build-7 write path verifies the file exists or throws. Deleting an item or deleting all data removes the files.
- db.ts: the schema has not changed since v1.0, so no migration is needed. Foreign keys are on per connection, so deletes cascade to photos. LIKE wildcards are escaped. Default rooms are seeded only into an empty table.
- money totals: integer cents throughout; SUM is wrapped in COALESCE; formatCents handles 0
- Report: the PDF is gated to Pro and refuses to run with 0 items; a missing photo shows a visible placeholder; HTML is escaped; the diagnostic strings are not printed into the PDF
- Free tier: the 30-item cap is enforced at the FAB and the photo cap in `pickPhoto`; lapsed users keep and can edit everything. No path gives Pro for free.
- purchases usage: Paywall buy and restore and Settings restore set Pro only from the RevenueCat entitlement; onboarding skips the paywall for Pro users; `ready` gates the UI
- reviews.ts: asks once after the first item or the first PDF; guarded by `hasAction()`; errors are swallowed
- Scanner: debounced, and camera permission is handled; the camera and photo-library usage strings are in app.json
- Settings JSON.parse is wrapped in try/catch
