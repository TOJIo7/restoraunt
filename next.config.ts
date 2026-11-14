import type { NextConfig } from "next";

// cacheComponents выключен: касса почти полностью динамическая (сессия, смена, заказы),
// кэширование компонентов здесь только мешает.
const nextConfig: NextConfig = {
  experimental: {
    // фото блюд ужимаются в браузере, но оставляем запас
    serverActions: { bodySizeLimit: "4mb" },
  },
  // на Vercel положить в серверные функции базу и исходные фото (демо-режим, см. lib/db.ts)
  outputFileTracingIncludes: {
    "/**": ["./prisma/dev.db", "./uploads/**"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
