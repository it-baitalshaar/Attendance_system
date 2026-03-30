/* eslint-disable no-console */

/**
 * One-time Supabase Auth bootstrap: sets the password for a specific user email.
 *
 * Why a script (not an API route)?
 * - You avoid exposing password-management over HTTP.
 * - It runs once during setup using SUPABASE_SERVICE_ROLE_KEY from env.
 *
 * How to run:
 *   1) Set env vars (temporarily) for this command
 *   2) Run: npm run bootstrap:super-admin-password
 *
 * One-time behavior:
 * - After a successful update, this script writes a marker file:
 *   .super-admin-password-bootstrapped.json
 * - Next runs will exit immediately if the marker exists.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function mustGetEnv(key) {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is required (set it in .env.local or your shell env).`);
  return v;
}

function getEnvAny(keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v) return v;
  }
  return null;
}

async function main() {
  const markerPath = path.join(process.cwd(), '.super-admin-password-bootstrapped.json');
  if (fs.existsSync(markerPath)) {
    console.log(`[bootstrap-super-admin-password] Marker exists (${markerPath}). Skipping.`);
    return;
  }

  const supabaseUrl = getEnvAny(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']);
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      'Missing Supabase env vars. Need NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  const superAdminEmail = String(process.env.SUPER_ADMIN_EMAIL || 'itbaitalshaar@gmail.com').toLowerCase().trim();
  const superAdminPassword = mustGetEnv('SUPER_ADMIN_PASSWORD');

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`[bootstrap-super-admin-password] Looking up user by email: ${superAdminEmail}`);
  const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw new Error(listError.message);

  const user =
    (usersData?.users || []).find((u) => (u.email || '').toLowerCase().trim() === superAdminEmail) || null;

  if (!user) {
    throw new Error(`User not found in Supabase Auth for email=${superAdminEmail}`);
  }

  console.log(`[bootstrap-super-admin-password] Updating password for userId=${user.id}`);
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: superAdminPassword,
  });

  if (updateError) throw new Error(updateError.message);

  const markerPayload = {
    updatedAt: new Date().toISOString(),
    userId: user.id,
    email: user.email,
  };

  fs.writeFileSync(markerPath, JSON.stringify(markerPayload, null, 2), 'utf8');
  console.log(`[bootstrap-super-admin-password] Done. Marker written to: ${markerPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[bootstrap-super-admin-password] ERROR:', err?.message || err);
    process.exit(1);
  });

