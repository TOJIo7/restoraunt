-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Dish" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoryId" INTEGER NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameTg" TEXT NOT NULL,
    "descriptionRu" TEXT,
    "descriptionTg" TEXT,
    "price" INTEGER NOT NULL,
    "photo" TEXT,
    "inStopList" BOOLEAN NOT NULL DEFAULT false,
    "autoStopped" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Dish_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Dish" ("active", "categoryId", "descriptionRu", "descriptionTg", "id", "inStopList", "nameRu", "nameTg", "photo", "price", "sort") SELECT "active", "categoryId", "descriptionRu", "descriptionTg", "id", "inStopList", "nameRu", "nameTg", "photo", "price", "sort" FROM "Dish";
DROP TABLE "Dish";
ALTER TABLE "new_Dish" RENAME TO "Dish";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
