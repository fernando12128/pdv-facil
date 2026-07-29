import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

const configuredUrl = process.env.DATABASE_URL || "file:./dev.db";
const adapterUrl =
  configuredUrl.startsWith("file:./") &&
  !configuredUrl.startsWith("file:./prisma/")
    ? configuredUrl.replace("file:./", "file:./prisma/")
    : configuredUrl;

const adapter = new PrismaBetterSqlite3({
  url: adapterUrl,
});

export const prisma = new PrismaClient({
  adapter,
});
