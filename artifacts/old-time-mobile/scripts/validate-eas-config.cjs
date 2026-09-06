const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const EXPECTED_RELEASE_COMMIT = '5fe0df611f77997f9da389c37f7b3fa1535cb123';

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, fileName), 'utf8'));
}

function normalizeDomain(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is missing.`);
  }
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  const url = new URL(candidate);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${label} must be an HTTPS hostname without a path, query, or credentials.`);
  }
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.includes('.replit.dev')) {
    throw new Error(`${label} cannot point at a local or workspace development host.`);
  }
  return url.hostname;
}

function validateEasConfig() {
  const app = readJson('app.json').expo;
  const eas = readJson('eas.json');
  const appDomain = normalizeDomain(app.extra?.apiDomain, 'app.json expo.extra.apiDomain');
  if (app.extra?.releaseCommit !== EXPECTED_RELEASE_COMMIT) {
    throw new Error(`app.json expo.extra.releaseCommit must be ${EXPECTED_RELEASE_COMMIT}.`);
  }
  const firebaseConfig = fs.readFileSync(path.join(projectRoot, 'firebaseConfig.js'), 'utf8');

  if (!firebaseConfig.includes('projectId: "oldtime-a23af"')) {
    throw new Error('firebaseConfig.js is not configured for the Old Time Firebase project.');
  }
  if (!/apiKey:\s*["'][^"']+["']/.test(firebaseConfig)) {
    throw new Error('firebaseConfig.js is missing the public Firebase API key.');
  }

  for (const [profileName, profile] of Object.entries(eas.build ?? {})) {
    const profileDomain = normalizeDomain(profile.env?.EXPO_PUBLIC_DOMAIN, `eas.json build.${profileName}.env.EXPO_PUBLIC_DOMAIN`);
    if (profileDomain !== appDomain) {
      throw new Error(`EAS profile "${profileName}" points to ${profileDomain}, but app.json points to ${appDomain}.`);
    }
    if (profile.env?.EXPO_PUBLIC_RELEASE_COMMIT !== EXPECTED_RELEASE_COMMIT) {
      throw new Error(`EAS profile "${profileName}" is not pinned to release ${EXPECTED_RELEASE_COMMIT}.`);
    }
  }

  console.log(`EAS auth configuration valid: ${appDomain} @ ${EXPECTED_RELEASE_COMMIT}`);
}

if (require.main === module) {
  try {
    validateEasConfig();
  } catch (error) {
    console.error(`EAS auth configuration invalid: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { validateEasConfig };