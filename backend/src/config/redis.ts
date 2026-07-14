import { createClient } from "redis";
import { env } from "./env";

export const redisClient = createClient({ url: env.redisUrl });

redisClient.on("error", (err) => {
  console.error("Redis client error", err);
});
