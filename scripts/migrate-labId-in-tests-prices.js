// scripts/migrate-labId-in-tests-prices.js
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

async function migrateLabIdsInTests() {
  // Step 1: Build normalized labName -> labId map
  const labsSnap = await db.collection('labs').get();
  const labNameToId = {};
  labsSnap.forEach(doc => {
    const data = doc.data();
    if (data.name) {
      labNameToId[normalizeLabName(data.name)] = doc.id;
    }
  });

  // Step 2: Fetch all tests
  const testsSnap = await db.collection('tests').get();
  let updated = 0;
  let unmatchedLabNames = new Set();

  for (const testDoc of testsSnap.docs) {
    const testData = testDoc.data();
    if (!Array.isArray(testData.prices)) continue;
    let changed = false;
    const newPrices = testData.prices.map(price => {
      if (price.labId) return price; // Already has labId
      if (!price.labName) return price;
      const normalized = normalizeLabName(price.labName);
      const labId = labNameToId[normalized];
      if (labId) {
        changed = true;
        return { ...price, labId };
      } else {
        unmatchedLabNames.add(price.labName);
      }
      return price;
    });
    if (changed) {
      await testDoc.ref.update({ prices: newPrices });
      updated++;
      console.log(`Updated test ${testDoc.id}`);
    }
  }
  if (unmatchedLabNames.size > 0) {
    console.warn('Unmatched lab names:', Array.from(unmatchedLabNames));
  }
  console.log(`Migration complete. Updated ${updated} test docs.`);
  process.exit(0);
}

migrateLabIdsInTests().catch(e => { console.error(e); process.exit(1); }); 