// Builds a fresh, isolated test database from the repo's own SQL (schema -> seeds -> migrations), so the suite never
// touches development data and doubles as proof that a new install works.
// Usage: node tests/setup-db.js      (env: TEST_DATABASE_URL, default postgresql://murat@localhost:5432/cadovet_test)
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://murat@localhost:5432/cadovet_test';
const SQL_DIR = path.resolve(__dirname, '../src/database');
const ORDER = [
  'schema', 'seeds', 'migrate_phase2', 'migrate_phase3', 'migrate_phase4', 'migrate_phase5_6', 'migrate_inventory_transactions', 'migrate_locations',
  'migrate_mobile', 'migrate_records_offers', 'migrate_blog', 'migrate_password_reset', 'migrate_otp', 'migrate_hardening', 'migrate_workflow', 'migrate_split_subadmin', 'migrate_staff_auth', 'migrate_doctor_scope', 'migrate_prescription_note', 'migrate_public_booking_pet_details', 'migrate_emergency', 'migrate_service_image', 'migrate_transaction_slip', 'migrate_services_catalog_sync', 'migrate_services_marketing_fields',
];

async function main() {
  const url = new URL(TEST_DB_URL);
  const dbName = url.pathname.slice(1);
  if (!/_test$/.test(dbName)) throw new Error(`Refusing to reset "${dbName}": test database names must end in _test`);

  const admin = new Client({ connectionString: TEST_DB_URL.replace(`/${dbName}`, '/postgres') });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();

  const db = new Client({ connectionString: TEST_DB_URL });
  await db.connect();
  for (const name of ORDER) {
    const file = path.join(SQL_DIR, `${name}.sql`);
    if (!fs.existsSync(file)) continue; // migrate_hardening.sql is added alongside the fixes it contains
    await db.query(fs.readFileSync(file, 'utf8'));
  }
  await db.end();
  console.log(`test database "${dbName}" ready`);
}

main().catch((e) => { console.error(e); process.exit(1); });
