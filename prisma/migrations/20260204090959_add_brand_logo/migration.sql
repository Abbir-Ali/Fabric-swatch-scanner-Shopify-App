/*
  Warnings:

  - You are about to drop the column `lineItemIds` on the `ScanLog` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN "brandLogo" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ScanLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "scannedBy" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" TEXT,
    "staffEmail" TEXT
);
INSERT INTO "new_ScanLog" ("details", "id", "orderId", "scannedBy", "shop", "staffEmail", "status", "timestamp") SELECT "details", "id", "orderId", "scannedBy", "shop", "staffEmail", "status", "timestamp" FROM "ScanLog";
DROP TABLE "ScanLog";
ALTER TABLE "new_ScanLog" RENAME TO "ScanLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
