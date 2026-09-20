'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cryptoLib = require('../lib/crypto');
const policyLib = require('./lib/policy');

function defaultWorkspace() {
  return process.env.AIFEED_STUDIO_HOME || path.join(os.homedir(), '.aifeed-studio');
}

function projectIdFor(domain) {
  return String(domain || '').trim().toLowerCase().replace(/[^a-z0-9.-]/g, '_');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

class Workspace {
  constructor(root) {
    this.root = path.resolve(root || defaultWorkspace());
    ensureDir(this.root);
    ensureDir(path.join(this.root, 'projects'));
  }

  list() {
    return readJson(path.join(this.root, 'projects.json'), []);
  }

  saveList(list) {
    writeJson(path.join(this.root, 'projects.json'), list);
  }

  projectDir(id) {
    return path.join(this.root, 'projects', id);
  }

  paths(id) {
    const dir = this.projectDir(id);
    return {
      dir,
      keyPath: path.join(dir, 'aifeed-private.pem'),
      publicKeyPath: path.join(dir, 'aifeed-public.txt'),
      projectPath: path.join(dir, 'project.json'),
      policyPath: path.join(dir, 'policy.json'),
      statePath: path.join(dir, 'state.json'),
      outDir: path.join(dir, 'build'),
      cacheDir: path.join(dir, 'cache')
    };
  }

  summary(id) {
    const project = this.project(id);
    if (!project) return null;
    const state = this.state(id);
    return {
      id: project.id,
      domain: project.domain,
      name: project.name,
      type: project.type,
      profile: project.profile,
      source: project.source || null,
      pages: state && state.pages ? Object.keys(state.pages).length : 0,
      built_at: state ? state.built_at : null
    };
  }

  create(input) {
    const domain = String(input.domain || '').trim().toLowerCase();
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
      throw new Error('invalid domain: ' + input.domain);
    }
    const id = projectIdFor(domain);
    const list = this.list();
    if (list.some((entry) => entry.id === id)) throw new Error('project already exists: ' + id);

    const paths = this.paths(id);
    ensureDir(paths.dir);
    ensureDir(paths.cacheDir);

    const { privateKey, publicKey } = cryptoLib.generateKeyPair();
    fs.writeFileSync(paths.keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    const publicKeyValue = cryptoLib.encodePublicKey(publicKey);
    const fingerprint = cryptoLib.fingerprintOf(publicKey);
    fs.writeFileSync(paths.publicKeyPath, publicKeyValue + '\n' + fingerprint + '\n');

    const project = {
      id,
      domain,
      name: input.name || domain,
      type: input.type || 'blog',
      locale: input.locale || 'en',
      contact: input.contact || 'mailto:admin@' + domain,
      description: input.description || '',
      profile: ['aimd', 'mako', 'both'].includes(input.profile) ? input.profile : 'both',
      key_id: input.keyId || id + '-key1',
      created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      source: null
    };
    writeJson(paths.projectPath, project);
    writeJson(paths.policyPath, policyLib.DEFAULT_POLICY);

    list.push({ id, domain: project.domain, name: project.name, created_at: project.created_at });
    this.saveList(list);
    return { ...project, fingerprint, publicKeyValue };
  }

  project(id) {
    const paths = this.paths(id);
    return readJson(paths.projectPath, null);
  }

  saveProject(id, project) {
    writeJson(this.paths(id).projectPath, project);
  }

  policy(id) {
    const raw = readJson(this.paths(id).policyPath, null);
    return policyLib.normalizePolicy(raw || {});
  }

  savePolicy(id, policy) {
    const normalized = policyLib.normalizePolicy(policy);
    writeJson(this.paths(id).policyPath, normalized);
    return normalized;
  }

  state(id) {
    return readJson(this.paths(id).statePath, null);
  }

  saveState(id, state) {
    writeJson(this.paths(id).statePath, state);
  }

  fingerprint(id) {
    const paths = this.paths(id);
    try {
      const publicKey = require('node:crypto').createPublicKey(fs.readFileSync(paths.keyPath));
      return cryptoLib.fingerprintOf(publicKey);
    } catch (error) {
      return null;
    }
  }
}

module.exports = { Workspace, defaultWorkspace, projectIdFor, ensureDir, readJson, writeJson };
