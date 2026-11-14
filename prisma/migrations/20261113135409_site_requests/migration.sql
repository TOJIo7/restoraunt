-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN "lat" REAL;
ALTER TABLE "Delivery" ADD COLUMN "lng" REAL;

-- CreateTable
CREATE TABLE "SiteRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "comment" TEXT,
    "orderType" TEXT,
    "address" TEXT,
    "lat" REAL,
    "lng" REAL,
    "payMethod" TEXT,
    "items" TEXT,
    "total" INTEGER,
    "startsAt" DATETIME,
    "guests" INTEGER,
    "orderId" INTEGER,
    "reservationId" INTEGER,
    "rejectReason" TEXT,
    "handledById" INTEGER,
    "handledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "SiteRequest_status_createdAt_idx" ON "SiteRequest"("status", "createdAt");
