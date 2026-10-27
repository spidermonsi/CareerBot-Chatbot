import mongoose from "mongoose";

type Cache = {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
};

// keep the connection  on globalThis so it survives hot reloads and is reused between requests
const g = globalThis as typeof globalThis & { mongooseCache?: Cache };
const cache: Cache = g.mongooseCache ?? { conn: null, promise: null };
g.mongooseCache = cache;

export async function connectDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("MONGODB_URI is missing!");
    }

    if (cache.conn) return cache.conn; // already connected, reuse it

    if (!cache.promise) {
        cache.promise = mongoose.connect(uri, { bufferCommands: false});
    } 

    try {
        cache.conn = await cache.promise;
    } catch (err) {
        cache.promise = null; // allow a retry on the next request
        throw err;
    }
    return cache.conn;
}
