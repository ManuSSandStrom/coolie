import mongoose from "mongoose";

let connecting;

export async function connectMongo(uri) {
  if (!uri) throw new Error("MONGODB_URI is required");
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connecting) return connecting;
  mongoose.set('strictQuery', true);
  if (process.env.MONGOOSE_DEBUG === '1') mongoose.set('debug', true);
  connecting = mongoose.connect(uri, {
    dbName: 'coolie',
    serverSelectionTimeoutMS: 10000,
  }).then(conn => {
    const cs = conn.connection;
    const host = (cs.hosts && cs.hosts[0]) || cs.host || 'cluster';
    console.log(`[mongo] connected to ${host} db=${cs.name}`);
    return cs;
  }).catch(err => {
    console.error('[mongo] connection error:', err.message);
    connecting = undefined;
    throw err;
  });
  return connecting;
}

export async function pingMongo() {
  if (mongoose.connection.readyState !== 1) throw new Error('not connected');
  await mongoose.connection.db.admin().command({ ping: 1 });
  return { ok: true };
}
