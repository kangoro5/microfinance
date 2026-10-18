const { MongoClient } = require('mongodb');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const uri = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/microfinance?replicaSet=rs0';
const databaseUrl = new URL(uri);
const replicaSet = databaseUrl.searchParams.get('replicaSet') || 'rs0';
const memberHost = databaseUrl.host;
databaseUrl.searchParams.delete('replicaSet');
const client = new MongoClient(databaseUrl.toString(), {
  directConnection: true,
  serverSelectionTimeoutMS: 5000
});

(async () => {
  try {
    await client.connect();
    const admin = client.db('admin');
    const status = await admin.command({ replSetGetStatus: 1 }).catch((err) => ({ ok: 0, error: err.message }));
    console.log('status-before=' + JSON.stringify(status));

    if (!status || !status.ok) {
      const res = await admin.command({
        replSetInitiate: {
          _id: replicaSet,
          members: [{ _id: 0, host: memberHost }]
        }
      });
      console.log('initiate=' + JSON.stringify(res));
      let after;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((r) => setTimeout(r, 1000));
        after = await admin.command({ replSetGetStatus: 1 });
        if (after.members.some((member) => member.stateStr === 'PRIMARY')) break;
      }
      console.log('status-after=' + JSON.stringify(after));
      if (!after.members.some((member) => member.stateStr === 'PRIMARY')) {
        throw new Error('Replica set did not elect a PRIMARY within 30 seconds');
      }
    }
  } catch (err) {
    console.error('ERR=' + err.message);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
})();
