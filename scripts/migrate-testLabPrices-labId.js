// scripts/migrate-testLabPrices-labId.js
const admin = require('firebase-admin');
const serviceAccount = require('../server/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

function normalizeLabName(name) {
  return name
    .replace(/lab$/i, '') // remove 'lab' at end
    .replace(/\s+/g, ' ') // collapse spaces
    .trim()
    .toLowerCase();
}

async function migrateLabIds() {
  const labsSnap = await db.collection('labs').get();
  const labNameToId = {};
  labsSnap.forEach(doc => {
    const data = doc.data();
    if (data.name) {
      labNameToId[normalizeLabName(data.name)] = doc.id;
    }
  });

  const pricesSnap = await db.collection('testLabPrices').get();
  let updated = 0;
  let unmatchedLabNames = new Set();

  for (const doc of pricesSnap.docs) {
    const data = doc.data();
    if (data.labId || !data.labName) continue;
    const normalized = normalizeLabName(data.labName);
    const labId = labNameToId[normalized];
    if (labId) {
      await doc.ref.update({ labId });
      updated++;
      console.log(`Updated ${doc.id}: labId=${labId}`);
    } else {
      unmatchedLabNames.add(data.labName);
      console.warn(`No lab found for labName: ${data.labName}`);
    }
  }
  if (unmatchedLabNames.size > 0) {
    console.warn('Unmatched lab names:', Array.from(unmatchedLabNames));
  }
  console.log(`Migration complete. Updated ${updated} testLabPrices docs.`);
  process.exit(0);
}

migrateLabIds().catch(e => { console.error(e); process.exit(1); }); 