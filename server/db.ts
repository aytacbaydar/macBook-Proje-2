import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema";

// Veritabanı bağlantı URL'si
const connectionString = process.env.DATABASE_URL!;

// Veritabanı istemcisi oluştur
const client = postgres(connectionString);

// Drizzle ile ORM oluştur
export const db = drizzle(client, { schema });