import fs from 'fs';
import net from 'net';
import { spawn } from 'child_process';
import { logger } from '../config/logger';

export type ScanResult = 'clean' | 'infected' | 'error';
export type VirusScannerStatus = {
  configured: boolean;
  enabled: boolean;
  target: 'command' | 'socket' | null;
  lastRunAt: string | null;
  lastResult: ScanResult | null;
  lastError: string | null;
};

const log = logger.child({ module: 'virus-scanner' });

const scannerState: {
  lastRunAt: Date | null;
  lastResult: ScanResult | null;
  lastError: string | null;
  lastTarget: 'command' | 'socket' | null;
} = {
  lastRunAt: null,
  lastResult: null,
  lastError: null,
  lastTarget: null,
};

const SCAN_TIMEOUT_MS = 15_000;

function isConfigured() {
  return process.env.AV_SCANNER_ENABLED === 'true';
}

function isEnabled() {
  return isConfigured() && process.env.NODE_ENV !== 'test';
}

function getScannerTarget(): 'command' | 'socket' | null {
  if (process.env.AV_SCANNER_HOST && process.env.AV_SCANNER_PORT) {
    return 'socket';
  }
  return 'command';
}

function recordResult(result: ScanResult, target: 'command' | 'socket' | null, error?: unknown) {
  scannerState.lastRunAt = new Date();
  scannerState.lastResult = result;
  scannerState.lastTarget = target;
  scannerState.lastError = error ? (error instanceof Error ? error.message : String(error)) : null;
}

function parseCommand(cmd: string): { command: string; args: string[] } {
  const tokens = cmd.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  const [command, ...args] = tokens.map((part) => part.replace(/^"(.*)"$/, '$1'));
  return { command: command || cmd, args };
}

async function scanWithCommand(filePath: string, commandString: string): Promise<ScanResult> {
  const { command, args } = parseCommand(commandString);
  return new Promise<ScanResult>((resolve) => {
    const proc = spawn(command, [...args, filePath], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const settle = (result: ScanResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    proc.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', () => settle('error'));
    proc.on('close', (code) => {
      const output = `${stdout} ${stderr}`.toLowerCase();
      if (output.includes('found') || output.includes('infected') || code === 1) {
        settle('infected');
        return;
      }
      if (code === 0 || output.includes('ok')) {
        settle('clean');
        return;
      }
      settle('error');
    });
  });
}

async function scanWithSocket(
  filePath: string,
  host: string,
  port: number
): Promise<ScanResult> {
  return new Promise<ScanResult>((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const settle = (result: ScanResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(SCAN_TIMEOUT_MS, () => settle('error'));
    socket.on('error', () => settle('error'));
    socket.on('data', (data) => {
      const text = data.toString().toUpperCase();
      if (text.includes('FOUND')) {
        settle('infected');
      } else if (text.includes('OK')) {
        settle('clean');
      } else {
        settle('error');
      }
    });

    socket.on('connect', () => {
      socket.write('zINSTREAM\u0000');
      const readStream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });

      readStream.on('data', (chunk) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const length = Buffer.alloc(4);
        length.writeUInt32BE(buffer.length, 0);
        socket.write(length);
        socket.write(buffer);
      });

      readStream.on('error', () => settle('error'));
      readStream.on('end', () => {
        const terminator = Buffer.alloc(4);
        terminator.writeUInt32BE(0, 0);
        socket.write(terminator);
      });
    });

    socket.on('close', () => {
      if (!settled) {
        settle('error');
      }
    });
  });
}

export async function scanFile(filePath: string): Promise<ScanResult> {
  const enabled = isEnabled();

  if (!enabled) {
    recordResult('clean', null);
    return 'clean';
  }

  const target = getScannerTarget();
  const command = process.env.AV_SCANNER_CMD?.trim() || 'clamscan --no-summary';
  const host = process.env.AV_SCANNER_HOST;
  const portStr = process.env.AV_SCANNER_PORT;

  try {
    let result: ScanResult;
    if (target === 'socket') {
      const port = Number(portStr);
      if (!host || !Number.isInteger(port)) {
        throw new Error('Invalid AV_SCANNER_HOST/PORT');
      }
      result = await scanWithSocket(filePath, host, port);
    } else {
      result = await scanWithCommand(filePath, command);
    }

    recordResult(result, target);

    if (result === 'infected') {
      log.warn({ path: filePath }, 'infected file blocked');
    }
    return result;
  } catch (err) {
    log.error({ err, path: filePath }, 'virus scan failed');
    recordResult('error', target, err);
    return 'error';
  }
}

export function getVirusScannerStatus(): VirusScannerStatus {
  const configured = isConfigured();
  const enabled = isEnabled();
  return {
    configured,
    enabled,
    target: scannerState.lastTarget,
    lastRunAt: scannerState.lastRunAt ? scannerState.lastRunAt.toISOString() : null,
    lastResult: scannerState.lastResult,
    lastError: scannerState.lastError,
  };
}
