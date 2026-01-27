# Implementation Plan: Fabric-scanner-system Rebuild

This plan outlines the steps to recreate the "Fabric-scanner-system" with specific requirements for fabric swatch inventory management and order fulfillment using a barcode scanner.

## Proposed Changes

### Project Configuration
- [ ] Initialize Shopify App using Remix template.
- [ ] Update `shopify.app.toml` with:
    - Scopes: `write_products, read_products, read_orders, read_merchant_managed_fulfillment_orders, write_merchant_managed_fulfillment_orders`
    - App Proxy: `Subpath Prefix: apps`, `Subpath: fabric-scanner`, `Proxy URL: /api/proxy`

### Database (Prisma)
- [ ] Update `prisma/schema.prisma` with `ScanLog`, `AppSettings`, and `Staff` models.
- [ ] Run `npx prisma migrate dev` to apply changes.

### Backend (Remix)
- [ ] Create `app/routes/api.proxy.$.jsx` to handle proxy requests.
- [ ] Implement GraphQL queries for `getInventory` and `getFabricOrders`.
- [ ] Implement `auth` type handler in proxy to validate Admin/Staff PINs.
- [ ] Implement fulfillment logic using `fulfillmentCreateV2`.

### Frontend (Theme App Extension)
- [ ] Generate a new Theme App Extension.
- [ ] Implement `scanner.liquid` with:
    - Modern Tabbed UI (**Available Fabrics**, **Unfulfilled Fabric Orders**, **History**).
    - Authentication screen with PIN toggle visibility.
    - Scanning modal using `html5-qrcode`.
    - Feedback: Vibration and beep on success.
- [ ] Implement local session management (`fb_session_stable`).

## Verification Plan

### Automated Tests
- N/A (Manual verification on Shopify store).

### Manual Verification
- [x] Verify app installation and scope approval.
- [x] Test Admin/Staff login flow via proxy.
- [x] Verify inventory list displays only "Swatch Item" product types.
- [x] Verify order list displays only "swatch-only" tagged orders.
- [ ] Test barcode scanning and fulfillment flow.
- [ ] Check `ScanLog` entries after fulfillment.
