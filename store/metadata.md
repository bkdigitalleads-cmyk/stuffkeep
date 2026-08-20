# StuffKeep — App Store Metadata (ready to paste)

## App name (30 chars max)
`StuffKeep: Home Inventory` (25)

## Subtitle (30 chars max)
`Insurance list, photos, value` (29 — "insurance" is the killer-use-case keyword from autocomplete)

## Keywords (100 chars max, no words already in name/subtitle)
`contents,belongings,claim,catalog,barcode,serial,moving,estate,organizer,room,track,renters,fire`
(96 chars — "contents" targets Home Contents' brand keyword; renters/fire from insurance intent)

## Promotional text (170 chars max)
`Walk a room, snap photos, add values — and get a claim-ready insurance report of everything you own. Private, offline, on your iPhone only.`

## Description
The day you need a home inventory, it's too late to make one.

Fire, flood, break-in — when the worst happens, your insurer asks one question: what did you have? StuffKeep makes sure you always have the answer. Walk through a room, snap a photo, add a value. Ten minutes tonight becomes proof worth thousands on the day of a claim.

WHY STUFFKEEP
• Fast entry: photo → name → value → done
• See what your stuff is worth, room by room and in total
• Serial & barcode capture for exact claim records
• Works completely offline — no account, no signup

INSURANCE-READY REPORT
Generate a polished PDF of your entire inventory — photos, serial numbers, values, room-by-room totals. Email it to yourself so a copy survives whatever your stuff doesn't. Your insurance agent will love you.

COMPLETELY PRIVATE
A list of your valuables is sensitive. StuffKeep keeps it on your iPhone — no cloud, no account, no tracking, nothing to breach. Optional Face ID lock.

STUFFKEEP PRO
Free documents up to 30 items with a photo each. Pro unlocks unlimited items, up to 6 photos per item, the insurance PDF report, CSV export, and Face ID lock. Yearly (with a 7-day free trial) or one-time Lifetime.

Start with one room tonight. Future you — standing in front of an adjuster — says thanks.

Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://bkdigitalleads-cmyk.github.io/stuffkeep/privacy.html

## Category
Primary: Lifestyle · Secondary: Productivity

## Age rating
4+ · Content Rights: no third-party content

## Price
Free with in-app purchases

## In-App Purchases (create in ASC — same playbook as OneLine)
| Product ID | Type | Price | Notes |
|---|---|---|---|
| `stuffkeep_pro_yearly` | Auto-renewing subscription | $19.99/yr | 7-day free trial, group "StuffKeep Pro" |
| `stuffkeep_pro_lifetime` | Non-consumable | $29.99 | one-time, anchors yearly |
RevenueCat entitlement: `pro` (new RC app under existing project or new project).

## App Privacy labels
- Purchases → Purchase History: App Functionality, linked, no tracking
- Identifiers → User ID (RevenueCat anonymous): App Functionality, linked, no tracking
- Everything else: Data Not Collected

## Review notes
StuffKeep is a fully offline home-inventory app. No login or account exists; no demo
credentials are needed. To test Pro features use the sandbox purchase flow on the paywall
(Settings → StuffKeep Pro banner). All data is stored on-device in SQLite; photos in the
app sandbox. Camera is used to photograph belongings and scan barcodes/serials only.

## Pre-submission checklist (lessons from OneLine — do not repeat)
- [ ] EULA link present in description (done above) — 3.1.2 rejection avoided
- [ ] Content Rights answered in App Information before Add for Review
- [ ] Subscription GROUP localized and added to the submission as its own item
- [ ] IAP review screenshot at 1284×2778
- [ ] Device screen recording ready BEFORE submitting (launch → add item w/ photo →
      report tab → paywall → purchase completes → Pro features unlock) — 2.1 avoided
- [ ] Review contact typed with real key events + Save
