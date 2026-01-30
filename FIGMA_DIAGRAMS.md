# Fabric Scanner — Figma Diagrams

Colorful workflow diagrams matching the exact UI flow of the Fabric Scanner system. Created in FigJam and editable in Figma.

---

## Admin Dashboard

The admin side starts at the **Dashboard** (`/app`). Merchants land here after OAuth and use the NavMenu to move to other pages.

**Diagram:** [Open in Figma](https://www.figma.com/online-whiteboard/create-diagram/50bce69f-e468-490c-9e09-00720b3bf569?utm_source=other&utm_content=edit_in_figjam&oai_id=&request_id=8d84bc43-55ac-45f5-80ef-99872267599e)

**UI Flow:**
- **Stats Cards Row:** Total Scans Today, Total Pending Orders, Total Fulfilled
- **Pending Swatch Orders Card:** Collapsible order cards (Order name, Badge PENDING, timestamp) → Expanded: Thumbnail, title, SKU, Qty, Barcode per line item → Pagination
- **Fulfilled History Card:** Same structure with Badge FULFILLED, scannedBy → Pagination
- **Auto-refresh** every 5 seconds
- **NavMenu:** Dashboard, Swatch Item Inventory, Scan Logs, Staff & Settings

---

## Admin — Swatch Inventory, Scan Logs & Settings

Detailed UI for the other admin pages.

**Diagram:** [Open in Figma](https://www.figma.com/online-whiteboard/create-diagram/246ba9f2-83a8-4a5c-97ad-0db96659b494?utm_source=other&utm_content=edit_in_figjam&oai_id=&request_id=bd874580-34e1-4f34-96dc-f47c5bfb451b)

**UI Flow:**
- **Swatch Item Inventory:** IndexFilters sort dropdown → IndexTable (Image, Product Detail, Stock Status, Bin Location inline edit, Barcode Ref, View link) → Pagination → BinEditor (Set Bin / Edit → metafieldsSet)
- **Scan Logs:** Search TextField (Order ID or Staff) → IndexTable (Time, Order ID, Status, Scanned By, Details) → Pagination
- **Staff & Settings:** Staff Members table (Add Staff, Name, Email, PIN, Edit, Delete) + Modal for Add/Edit → Global Admin Credentials (Admin Name, Admin PIN show/hide, Save button)

---

## App Front End (Fabric Scanner System)

The frontend starts with the **Login process**. Staff must sign in with Name/Email + PIN before using the scanner.

**Diagram:** [Open in Figma](https://www.figma.com/online-whiteboard/create-diagram/42665161-e1ff-446a-9f4f-ba4dd460257b?utm_source=other&utm_content=edit_in_figjam&oai_id=&request_id=b85c7d05-1525-46fd-96df-07c8d0b8675d)

**UI Flow:**
- **Auth Section:** Username/Email input, PIN input, Login button, Clear Old Session (if stale)
- **After Login:** Header (SWATCH SCANNER, User badge, Logout) + Tab Bar (Stock | Orders | History)
- **Stock Tab:** Sort dropdown (Newest, Oldest, A-Z, Stock) → Stock cards (BIN, Print Label, image, title, SKU, Stock) → Pagination
- **Orders Tab (Pending Orders):** Order cards (collapsible) → Order header (ORDER name, chevron) → Order items (image, title, BIN, SKU) → Per item: **Scan** button OR **Verified** badge → All verified: **Generate & Print Shipping Label** → Label printed: **Fulfill Order** button → Pagination
- **Camera Modal (Scan flow):** Title SCANNING [product], SKU, BIN #, Barcode reader (Html5Qrcode), CANCEL SCAN button
- **History Tab:** Fulfilled order cards (Order name, FULFILLED, Fulfilled by staff) → Pagination

---

## How to Use

1. Click a link above to open the diagram in FigJam.
2. Edit, style, and rearrange nodes as needed.
3. Copy frames into a Figma design file or export as image.

---

## Route Reference

| Route | Purpose |
|-------|---------|
| `/` | Public landing, redirect to /app if shop param |
| `/auth/login` | Shopify OAuth login |
| `/app` | Admin layout + Dashboard |
| `/app/fabric` | Swatch Item Inventory (bin editing) |
| `/app/logs` | Scan Logs |
| `/app/settings` | Staff & Admin credentials |
| `/app/print` | Print barcode labels (not in nav) |
| `/apps/fabric-scanner/get` | App Proxy: auth, inventory, orders, fulfilled, fulfill |
| `/webhooks/orders/updated` | Sync scan logs when order reverted |

---

## Key Data Models

- **ScanLog**: shop, orderId, status, scannedBy, staffEmail, details, timestamp
- **AppSettings**: shop, adminName, adminPin
- **Staff**: shop, name, email, pin
- **Shopify**: Orders (tag: swatch-only), Products (product_type: Swatch Item), FulfillmentOrders
