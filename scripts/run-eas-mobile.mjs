import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const appDir = path.join(repoRoot, 'artifacts', 'old-time-mobile');

function readGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

if (!existsSync(path.join(appDir, 'eas.json')) || !existsSync(path.join(appDir, 'app.json'))) {
  console.error(`Expected EAS app config in ${appDir}, but app.json or eas.json is missing.`);
  process.exit(1);
}

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: pnpm eas:mobile -- <eas arguments>');
  process.exit(1);
}

const branch = readGit(['branch', '--show-current']) || '(detached HEAD)';
const commit = readGit(['rev-parse', '--short', 'HEAD']) || '(unknown commit)';
const status = readGit(['status', '--short']);

console.log(`Running EAS from ${appDir}`);
console.log(`Building git source ${branch} @ ${commit}`);

if (status) {
  console.warn('Warning: git working tree has uncommitted changes.');
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(command, ['eas-cli', ...args], {
  cwd: appDir,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`Failed to start EAS CLI: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
