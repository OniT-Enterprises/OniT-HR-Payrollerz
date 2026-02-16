# Kaixa Standalone Roadmap

## The User: Maria (Kiosk Owner)

Maria sells phone credit, snacks, and cigarettes from a small stand in Dili. She has one employee. Today she uses a notebook. She will never use Meza web — it's too complex, she doesn't have a computer. But she has an Android phone.

**Her daily question:** "How much did I make today?"
**Her weekly question:** "How was this week compared to last week?"
**Her monthly question:** "Am I making money? How much do I owe for VAT?"
**Her credit question:** "João owes me $15, Maria owes me $8 — who's paying me back?"

---

## Feature Status

### Done

| Feature | Description |
|---------|-------------|
| Money In / Money Out | Two big buttons, category selection, notes |
| Today's summary | Tama/Sai/Lukru totals on Home + Money screens |
| Firestore persistence | Transactions save to cloud, real-time sync |
| VAT data model | Every transaction captures VAT fields (zeroed until VAT goes live) |
| Auth + tenant | Email login, multi-tenant support |
| Dark theme UI | Terracotta/warm palette, Tetum-first labels |
| Date range history | Today/week/month toggle on Money screen with filtered queries |
| Monthly summary | Period-aware totals (in, out, profit, VAT, tx count) |
| Business profile | Name, address, phone, VAT reg# — editable on Profile screen |
| Customer tabs | Credit tracking with debt/payment entries, WhatsApp reminders |
| Receipt generation | Text-based receipts shared via WhatsApp or native Share |
| Receipt numbering | Sequential receipt numbers (REC-YYYY-000001) for VAT compliance |
| VAT dashboard | Conditional card on Home screen when VAT active |
| Product catalog | CRUD for products with name, price, category, stock tracking |
| POS / Quick Sell | Tap-to-sell product grid, cart, checkout → creates transaction |
| Stock tracking | Basic inventory: track stock per product, decrement on sale |
| Monthly report | "Relatóriu Mensal" button generates shareable month summary |

### Meza Web VAT (also completed)

| Feature | Description |
|---------|-------------|
| VAT Settings | Platform status, registration, rate, filing frequency (`/money/vat-settings`) |
| Per-line VAT | Optional VAT rate override per invoice line item |
| VAT Return Builder | Monthly period selector, output/input/net VAT, save draft / mark filed (`/money/vat-returns`) |

### Remaining — Phase D

#### 1. Offline Support
**Priority: HIGH (biggest engineering effort)**
- Currently requires internet for every transaction
- TL has intermittent connectivity, especially outside Dili
- Need: local SQLite/WatermelonDB storage
- Need: sync queue — save locally, push to Firestore when online
- Need: conflict resolution for edge cases
- Need: offline VAT config cache (already partially done in vatStore)
- This is the difference between "works in Dili" and "works everywhere in TL"

#### 2. Bluetooth Printer
**Priority: MEDIUM**
- ESC/POS thermal printer support ($30 printers common in TL)
- Print receipts from POS checkout or transaction history
- Need: `react-native-ble-plx` or `expo-bluetooth` (when stable)
- Need: ESC/POS command builder for receipt formatting

---

## Build Order

### Phase A: Make It Useful — COMPLETE
1. ~~Date range history + monthly summary~~
2. ~~Business profile~~
3. ~~Customer tabs~~

### Phase B: Make It a POS — COMPLETE
4. ~~Receipt generation (WhatsApp sharing)~~
5. ~~Product catalog + quick sell~~
6. ~~Simple inventory (stock tracking)~~

### Phase C: VAT Ready — COMPLETE
7. ~~VAT dashboard~~
8. ~~Monthly report export~~
9. ~~Receipt VAT compliance (sequential numbering)~~

### Phase D: Works Everywhere — TODO
10. **Offline-first engine** — SQLite + sync queue
11. **Bluetooth printer** — ESC/POS thermal printing

---

## Data Model Summary

```
tenants/{tenantId}/
├── transactions/{txId}        # Money In/Out
├── products/{prodId}          # Product catalog
├── customerTabs/{tabId}       # Credit tracking
├── receiptCounters/{year}     # Sequential receipt numbering
├── settings/
│   ├── vat                    # VAT config
│   └── business_profile       # Business info
└── (vatReturns/{periodId})    # Meza web only
```

---

## Screen Map (5 Tabs)

```
Home (index.tsx)
├── Today summary (Tama/Sai/Lukru)
├── VAT dashboard (hidden until active)
├── Quick actions: Money In, Money Out, Faan, Tab, Relatóriu, Istoria
└── Recent transactions (last 5)

Money (money.tsx)
├── Period selector (Ohin/Semana/Fulan)
├── Summary bar (Tama/Sai/Lukru)
├── VAT bar (hidden until active)
├── Big action buttons (Osan Tama / Osan Sai)
├── Transaction list with share buttons
└── Entry modal (amount, category, note)

Sell (sell.tsx)
├── Product grid (tap to add to cart)
├── Cart bar (items, qty ±, totals)
├── Checkout → creates Money In transaction
├── Receipt sharing after checkout
└── FAB to add new products

Tab (sales.tsx — Customer Tabs)
├── Summary bar (customer count + total owed)
├── Expandable customer cards
├── Actions: + Devida, Selu, WhatsApp, Delete
├── Entry history per customer
└── FAB to add new customers

Profile (profile.tsx)
├── User info
├── Business profile (editable)
├── VAT registration (hidden until active)
├── Settings
└── Sign out
```
