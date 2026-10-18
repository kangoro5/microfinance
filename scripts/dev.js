const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const npmCli = path.join(
  process.execPath,
  '..',
  'node_modules',
  'npm',
  'bin',
  'npm-cli.js',
);
const commands = [
  ['API', ['run', 'dev', '--workspace=microfinance-backend']],
  ['WEB', ['run', 'dev', '--workspace=microfinance-frontend']],
];
const children = [];
let stopping = false;

function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;

  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === 'win32') {
      spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }
}

for (const [name, args] of commands) {
  const child = spawn(process.execPath, [npmCli, ...args], {
    cwd: root,
    shell: false,
    stdio: "inherit",
  });
  children.push(child);
  child.on('error', (error) => {
    console.error(`[${name}] ${error.message}`);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) {
      console.error(`[${name}] stopped; shutting down the other process`);
      stop(code || 1);
    }
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));