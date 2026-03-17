/*
 * Example helper showing how to obtain an auth token from the
 * `jwt-api-token-auth/` or `api-token-auth/` endpoints described in your
 * documentation.  No additional npm packages are required when running under
 * Node 18+ since `fetch` is globally available.
 *
 * Usage:
 *   export BASE_URL="http://zkeco.xmzkteco.com:8097"      # or localhost:8080
 *   export BIOTIME_USERNAME=admin
 *   export BIOTIME_PASSWORD=admin
 *   node scripts/get-auth-token.js
 *
 * The script will call both endpoints and log the JSON responses (token field).
 * Adapt the code to your needs (error handling, storing the token, etc.).
 */

import 'dotenv/config';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const USERNAME = process.env.BIOTIME_USERNAME;
const PASSWORD = process.env.BIOTIME_PASSWORD;

if (!USERNAME || !PASSWORD) {
  console.error('set BIOTIME_USERNAME and BIOTIME_PASSWORD environment variables');
  process.exit(1);
}

async function requestToken(path) {
  const url = `${BASE_URL.replace(/\/+$/,'')}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`request to ${path} failed: ${res.status} ${res.statusText} - ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  try {
    console.log('fetching JWT auth token...');
    const jwt = await requestToken('/jwt-api-token-auth/');
    console.log('JWT token response:', jwt);

    console.log('fetching general API token...');
    const api = await requestToken('/api-token-auth/');
    console.log('API token response:', api);
  } catch (err) {
    console.error('error obtaining token', err);
    process.exit(1);
  }
}

main();
