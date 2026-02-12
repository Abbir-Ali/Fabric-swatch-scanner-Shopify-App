# Deployment Day Revert Plan

This document identifies all changes made to implement the "Feature Visibility" and "Settings Synchronization" systems, providing a single prompt to restore the app to its baseline state.

## Affected Files

1.  **scanner.liquid** (`extensions/scanner-extension/blocks/scanner.liquid`): Contains the dynamic visibility logic (`updateUIVisibility`), background refresh (`refreshSettings`), and the state restoration logic.
2.  **app.settings.jsx** (`app/routes/app.settings.jsx`): Contains the "Feature Visibility" tab and its associated state/saving logic.
3.  **api.proxy.$.jsx** (`app/routes/api.proxy.$.jsx`): Handles the fresh `settings` endpoint and transmits toggles to the frontend.
4.  **settings.server.js** (`app/models/settings.server.js`): Handles database defaults for feature visibility.
5.  **schema.prisma** (`prisma/schema.prisma`): Defines the 8 toggle fields in the `AppSettings` model.

---

## The Deployment Day Prompt

Copy and paste the following prompt to the AI when you are ready to remove the feature toggles and synchronization logic:

> "It's deployment day! Please remove the 'Feature Visibility' and 'Settings Sync' systems. 
> 1. In `scanner.liquid`, remove `refreshSettings`, `updateUIVisibility`, and `switchTabAutomatically`. Remove all conditional display logic based on `currentUser` settings. 
> 2. In `app.settings.jsx`, remove the 'Feature Visibility' tab and all visibility state/form logic.
> 3. In `api.proxy.$.jsx`, remove the `settings` type and clean up the `auth` payload.
> 4. Clean up the Prisma schema by removing the boolean visibility fields.
> We want the scanner frontend to always show all features (Stock, Orders, History, Search, Sort, etc.) by default now."

---

## Technical Revert Steps (for the AI)

1.  **scanner.liquid**: 
    - Delete `updateUIVisibility`, `switchTabAutomatically`, and `refreshSettings` functions.
    - Remove the `refreshSettings()` call from `restoreSession`.
    - Restore `showApp` to its original state (removing `updateUIVisibility()` call).
    - Hardcode all tab buttons (`#tab-stock`, etc.) and UI elements to `display: block` or their default styles.
2.  **app.settings.jsx**: 
    - Remove the "Feature Visibility" tab from the `tabs` array.
    - Delete the `selectedTab === 2` UI block.
    - Remove visibility-related `useState` hooks and the `saveFeatures` action handler.
3.  **api.proxy.$.jsx**: 
    - Delete `case "settings"` from the loader.
    - Remove the visibility boolean fields from the `auth` case response.
4.  **schema.prisma**: Remove the 8 boolean fields (`showStockTab` through `showLogoutButton`) from `AppSettings` and run `npx prisma db push`.
