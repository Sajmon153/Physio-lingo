import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const isWin = process.platform === 'win32';
const binExt = isWin ? '.cmd' : '';
const tsxBin = path.join(ROOT, 'node_modules', '.bin', `tsx${binExt}`);
const viteBin = path.join(ROOT, 'node_modules', '.bin', `vite${binExt}`);

const children = [];
let shuttingDown = false;

function launch(name, command, args) {
  const child = spawn(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    shell: isWin,
  });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      shuttingDown = true;
      for (const other of children) {
        if (other !== child && !other.killed) {
          other.kill('SIGTERM');
        }
      }
      if (signal) {
        process.exit(0);
      } else {
        console.error(`[dev] ${name} exited with code ${code ?? 0}`);
        process.exit(code ?? 0);
      }
    }
  });
  return child;
}

function shutdown(sig) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill(sig);
    }
  }
  setTimeout(() => process.exit(0), 500).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

launch('api', tsxBin, ['server/index.ts']);
launch('web', viteBin, ['--port=3000', '--host=0.0.0.0']);
