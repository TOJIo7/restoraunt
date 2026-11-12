import type { NextConfig } from "next";

// cacheComponents выключен: касса почти полностью динамическая (сессия, смена, заказы),
// кэширование компонентов здесь только мешает.
const nextConfig: NextConfig = {
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
