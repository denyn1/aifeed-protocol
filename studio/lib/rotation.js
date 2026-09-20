'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const rotationLib = require('../../lib/rotation');

const CLI = path.join(__dirname, '..', '..', 'bin', 'cli.js');

function runCliRotate(args) {
  const result = spawnSync(process.execPath, [CLI, 'rotate', ...args], { encoding: 'utf8' });
  if (result.status !== 0) {
    const message = String(result.stderr || result.stdout || 'rotate command failed').trim();
    throw new Error(message);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    return { raw: result.stdout };
  }
}

function manifestStatus(outDir, now) {
  const manifestPath = path.join(outDir, '.well-known', 'ai.json');
  if (!fs.existsSync(manifestPath)) return { built: false, directive: null, phase: null };
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const directive = manifest.rotation || null;
  if (!directive) return { built: true, directive: null, phase: null };
  const state = rotationLib.validateDirective(manifest, now instanceof Date ? now : new Date());
  return {
    built: true,
    directive,
    phase: state.phase,
    errors: state.errors,
    warnings: state.warnings,
    public_key: manifest.identity.public_key,
    signed_at: manifest.validity.signed_at
  };
}

function prepareRotation(options) {
  const outDir = path.resolve(options.outDir);
  const manifestDir = path.join(outDir, '.well-known');
  const workspaceDir = path.resolve(options.workspaceDir);
  const windowHours = Math.max(1, Number(options.windowHours) || 72);
  const plan = runCliRotate([
    '--dir', manifestDir,
    '--key', options.keyPath,
    '--window', String(windowHours),
    '--lead', String(Math.max(0, Number(options.leadHours) || 24)),
    '--json'
  ]);
  const nextPrivate = path.join(manifestDir, 'aifeed-private.next.pem');
  const nextPublic = path.join(manifestDir, 'aifeed-public.next.txt');
  const movedPrivate = path.join(workspaceDir, 'aifeed-private.next.pem');
  const movedPublic = path.join(workspaceDir, 'aifeed-public.next.txt');
  if (fs.existsSync(nextPrivate)) fs.renameSync(nextPrivate, movedPrivate);
  if (fs.existsSync(nextPublic)) fs.renameSync(nextPublic, movedPublic);
  return { ...plan, successor_key: movedPrivate, successor_public: movedPublic };
}

function cutoverRotation(options) {
  const manifestDir = path.join(path.resolve(options.outDir), '.well-known');
  const workspaceDir = path.resolve(options.workspaceDir);
  const nextKey = path.join(workspaceDir, 'aifeed-private.next.pem');
  const plan = runCliRotate(['--dir', manifestDir, '--key', nextKey, '--json']);
  fs.copyFileSync(nextKey, options.keyPath);
  fs.chmodSync(options.keyPath, 0o600);
  const nextPublic = path.join(workspaceDir, 'aifeed-public.next.txt');
  if (fs.existsSync(nextPublic)) {
    fs.copyFileSync(nextPublic, options.publicKeyPath);
    fs.rmSync(nextPublic, { force: true });
  }
  fs.rmSync(nextKey, { force: true });
  return plan;
}

function exportedPrivateKeys(outDir) {
  const found = [];
  const walk = (dir, relative = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const child = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), child);
      else if (/private|\.pem$/i.test(entry.name)) found.push(child);
    }
  };
  if (fs.existsSync(outDir)) walk(outDir);
  return found;
}

module.exports = { manifestStatus, prepareRotation, cutoverRotation, exportedPrivateKeys, runCliRotate };
