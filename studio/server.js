#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { Workspace } = require('./workspace');
const policyLib = require('./lib/policy');
const siteLib = require('../lib/site');
const { publishProject } = require('./lib/publish');
const { verifyBuild } = require('./lib/verify');
const { crawlSite, STACK_ADAPTERS } = require('./lib/crawl');
const { createTarGz } = require('./lib/archive');
const { liveVerify } = require('./lib/live-verify');
const { manifestStatus, prepareRotation, cutoverRotation } = require('./lib/rotation');
const { validateAdvanced, importOpenApi } = require('./lib/advanced');
const { listPresets, TYPE_PRESETS } = require('./lib/presets');
const { createJobManager } = require('./jobs');

const VERSION = require('../package.json').version;
const UI_DIR = path.join(__dirname, 'ui');
const MAX_BODY = 1024 * 1024;

function allowPrivateTest() {
  return process.env.AIFEED_STUDIO_ALLOW_PRIVATE === '1';
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index++) {
    const item = argv[index];
    if (!item.startsWith('--')) continue;
    const equals = item.indexOf('=');
    if (equals !== -1) {
      args[item.slice(2, equals)] = item.slice(equals + 1);
      continue;
    }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      args[key] = next;
      index++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function json(res, status, body) {
  const text = JSON.stringify(body, null, 2) + '\n';
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store'
  });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) return resolve({});
      try {
        resolve(JSON.parse(text));
      } catch (error) {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function readPublicKeyValue(paths) {
  try {
    const lines = fs.readFileSync(paths.publicKeyPath, 'utf8').trim().split('\n');
    return lines[0] || '';
  } catch (error) {
    return '';
  }
}

function loadCrawlPages(paths) {
  let index;
  try {
    index = JSON.parse(fs.readFileSync(path.join(paths.cacheDir, 'crawl-index.json'), 'utf8'));
  } catch (error) {
    return [];
  }
  const pages = [];
  for (const [urlPath, entry] of Object.entries(index)) {
    const htmlPath = path.join(paths.cacheDir, 'pages', entry.file);
    if (fs.existsSync(htmlPath)) pages.push({ urlPath, htmlPath });
  }
  return pages.sort((a, b) => (a.urlPath < b.urlPath ? -1 : a.urlPath > b.urlPath ? 1 : 0));
}

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function serveStatic(res, pathname, token) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(UI_DIR, relative);
  if (target !== UI_DIR && !target.startsWith(UI_DIR + path.sep)) {
    return json(res, 404, { error: 'not found' });
  }
  let body;
  try {
    body = fs.readFileSync(target);
  } catch (error) {
    return json(res, 404, { error: 'not found' });
  }
  if (relative === 'index.html') {
    body = Buffer.from(body.toString('utf8').replace('%%STUDIO_TOKEN%%', token));
  }
  res.writeHead(200, { 'content-type': CONTENT_TYPES[path.extname(target)] || 'application/octet-stream' });
  res.end(body);
}

function createServer(options = {}) {
  const workspace = options.workspace instanceof Workspace ? options.workspace : new Workspace(options.workspace);
  const jobs = createJobManager();
  const token = randomBytes(16).toString('hex');

  function projectOrNull(id) {
    return workspace.project(id);
  }

  function projectSummaryList() {
    return workspace.list().map((entry) => workspace.summary(entry.id)).filter(Boolean);
  }

  async function handleApi(req, res, url) {
    const parts = url.pathname.split('/').filter(Boolean);
    // parts: ['api', ...]
    const method = req.method.toUpperCase();

    if (parts.length === 2 && parts[1] === 'info' && method === 'GET') {
      return json(res, 200, {
        name: 'AIFeed Studio',
        version: VERSION,
        workspace: workspace.root,
        projects: workspace.list().length
      });
    }

    if (parts.length === 2 && parts[1] === 'presets' && method === 'GET') {
      return json(res, 200, { presets: listPresets(), typePresets: TYPE_PRESETS });
    }

    if (parts.length === 2 && parts[1] === 'projects' && method === 'GET') {
      return json(res, 200, { projects: projectSummaryList() });
    }

    if (parts.length === 2 && parts[1] === 'projects' && method === 'POST') {
      const body = await readBody(req);
      const created = workspace.create(body);
      return json(res, 201, { project: created, policy: workspace.policy(created.id) });
    }

    if (parts.length >= 3 && parts[1] === 'projects') {
      const id = parts[2];
      const project = projectOrNull(id);
      if (!project) return json(res, 404, { error: 'project not found: ' + id });

      if (parts.length === 3 && method === 'GET') {
        const state = workspace.state(id);
        return json(res, 200, {
          project,
          policy: workspace.policy(id),
          fingerprint: workspace.fingerprint(id),
          outDir: workspace.paths(id).outDir,
          state: state ? {
            built_at: state.built_at,
            policy_hash: state.policy_hash,
            pages: Object.keys(state.pages || {}).length
          } : null
        });
      }

      if (parts.length === 3 && method === 'PUT') {
        const body = await readBody(req);
        if (body.profile !== undefined && !['aimd', 'mako', 'both'].includes(body.profile)) {
          return json(res, 400, { error: 'profile must be aimd, mako, or both' });
        }
        for (const field of ['name', 'type', 'locale', 'contact', 'description']) {
          if (body[field] !== undefined && typeof body[field] !== 'string') {
            return json(res, 400, { error: field + ' must be a string' });
          }
        }
        if (body.page_types !== undefined) {
          const errors = policyLib.validatePageTypes(body.page_types);
          if (errors.length > 0) return json(res, 400, { error: 'invalid page_types', errors });
        }
        if (body.freshness !== undefined && typeof body.freshness !== 'boolean') {
          return json(res, 400, { error: 'freshness must be a boolean' });
        }
        const updated = {
          ...project,
          name: body.name !== undefined ? body.name : project.name,
          type: body.type !== undefined ? body.type : project.type,
          locale: body.locale !== undefined ? body.locale : project.locale,
          contact: body.contact !== undefined ? body.contact : project.contact,
          description: body.description !== undefined ? body.description : project.description,
          profile: body.profile !== undefined ? body.profile : project.profile,
          page_types: body.page_types !== undefined ? body.page_types : project.page_types,
          freshness: body.freshness !== undefined ? body.freshness : project.freshness
        };
        workspace.saveProject(id, updated);
        return json(res, 200, { project: updated });
      }

      if (parts.length === 4 && parts[3] === 'policy' && method === 'PUT') {
        const body = await readBody(req);
        const errors = policyLib.validatePolicy(body.policy || body);
        if (errors.length > 0) return json(res, 400, { error: 'invalid policy', errors });
        const saved = workspace.savePolicy(id, body.policy || body);
        return json(res, 200, { policy: saved });
      }

      if (parts.length === 4 && parts[3] === 'advanced' && method === 'PUT') {
        const body = await readBody(req);
        const advanced = body.advanced !== undefined ? body.advanced : body;
        const errors = validateAdvanced(advanced, project, readPublicKeyValue(workspace.paths(id)));
        if (errors.length > 0) return json(res, 400, { error: 'invalid advanced manifest fields', errors });
        project.advanced = {};
        for (const key of ['types', 'capabilities', 'actions']) {
          if (advanced[key] !== undefined) project.advanced[key] = advanced[key];
        }
        workspace.saveProject(id, project);
        return json(res, 200, { advanced: project.advanced });
      }

      if (parts.length === 5 && parts[3] === 'advanced' && parts[4] === 'import-openapi' && method === 'POST') {
        const body = await readBody(req);
        const spec = body.spec || body;
        if (!spec || typeof spec !== 'object') {
          return json(res, 400, { error: 'import requires { spec: {...} }' });
        }
        return json(res, 200, importOpenApi(spec));
      }

      if (parts.length === 4 && parts[3] === 'source' && method === 'PUT') {
        const body = await readBody(req);
        if (body.type === 'local') {
          if (typeof body.dir !== 'string') {
            return json(res, 400, { error: 'local source requires { dir: "..." }' });
          }
          const dir = path.resolve(body.dir);
          if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
            return json(res, 400, { error: 'directory not found: ' + dir });
          }
          let pages = 0;
          try {
            pages = siteLib.collectHtmlFiles(dir).length;
          } catch (error) {
            return json(res, 400, { error: error.message });
          }
          if (body.stack !== undefined && !Object.prototype.hasOwnProperty.call(STACK_ADAPTERS, body.stack)) {
            return json(res, 400, { error: 'unknown stack: ' + body.stack });
          }
          project.source = {
            type: 'local',
            dir,
            pages,
            stack: body.stack ? { id: body.stack, adapter: STACK_ADAPTERS[body.stack] } : (project.source && project.source.stack) || null
          };
          workspace.saveProject(id, project);
          return json(res, 200, { source: project.source });
        }
        if (body.type === 'crawl') {
          let origin;
          try {
            origin = new URL(String(body.origin)).origin;
          } catch (error) {
            return json(res, 400, { error: 'crawl source requires { origin: "https://..." }' });
          }
          if (!origin.startsWith('https://') && !(allowPrivateTest() && origin.startsWith('http://'))) {
            return json(res, 400, { error: 'crawl origin must be https://' });
          }
          const toList = (value) => Array.isArray(value)
            ? value.map((entry) => String(entry)).filter(Boolean).slice(0, 100)
            : String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean).slice(0, 100);
          project.source = {
            type: 'crawl',
            origin,
            maxPages: Math.min(Math.max(Number(body.maxPages) || 500, 1), 50000),
            requestsPerSecond: Math.min(Math.max(Number(body.requestsPerSecond) || 2, 0.1), 50),
            include: toList(body.include),
            exclude: toList(body.exclude),
            respectRobots: body.respectRobots !== false,
            pages: project.source && project.source.origin === origin ? project.source.pages || 0 : 0,
            sitemap: project.source && project.source.origin === origin ? Boolean(project.source.sitemap) : false
          };
          workspace.saveProject(id, project);
          return json(res, 200, { source: project.source });
        }
        return json(res, 400, { error: 'source type must be "local" or "crawl"' });
      }

      if (parts.length === 4 && parts[3] === 'scan' && method === 'POST') {
        if (!project.source || project.source.type !== 'crawl') {
          return json(res, 400, { error: 'set a crawl source first' });
        }
        const paths = workspace.paths(id);
        const source = project.source;
        const jobId = jobs.start('scan', async (emit) => {
          emit({ type: 'progress', phase: 'start', done: 0, total: source.maxPages });
          const result = await crawlSite({
            origin: source.origin,
            cacheDir: paths.cacheDir,
            maxPages: source.maxPages,
            requestsPerSecond: source.requestsPerSecond,
            include: source.include,
            exclude: source.exclude,
            respectRobots: source.respectRobots,
            allowPrivate: allowPrivateTest(),
            onProgress: emit
          });
          source.pages = result.stats.total;
          source.sitemap = result.stats.sitemap;
          source.stack = result.stats.stack || source.stack || null;
          source.last_scan = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
          workspace.saveProject(id, project);
          return result.stats;
        });
        return json(res, 202, { jobId });
      }

      if (parts.length === 4 && parts[3] === 'build' && method === 'POST') {
        if (!project.source) {
          return json(res, 400, { error: 'set a source first' });
        }
        const paths = workspace.paths(id);
        let sourceDir = null;
        let pages = null;
        let sitemap;
        if (project.source.type === 'local') {
          sourceDir = project.source.dir;
        } else if (project.source.type === 'crawl') {
          pages = loadCrawlPages(paths);
          if (pages.length === 0) {
            return json(res, 400, { error: 'scan the site first' });
          }
          sitemap = project.source.sitemap === true;
        } else {
          return json(res, 400, { error: 'unknown source type: ' + project.source.type });
        }
        const jobId = jobs.start('build', async (emit) => {
          emit({ type: 'progress', phase: 'start', done: 0, total: pages ? pages.length : (project.source.pages || 0) });
          return publishProject({
            project,
            policy: workspace.policy(id),
            sourceDir,
            pages,
            sitemap,
            pageTypes: project.page_types || [],
            freshness: project.freshness !== false,
            advanced: project.advanced || undefined,
            rotation: project.rotation || undefined,
            outDir: paths.outDir,
            keyPath: paths.keyPath,
            statePath: paths.statePath,
            previousState: workspace.state(id),
            incremental: true,
            onProgress: emit
          });
        });
        return json(res, 202, { jobId });
      }

      if (parts.length === 5 && parts[3] === 'jobs' && method === 'GET') {
        const job = jobs.get(parts[4]);
        if (!job) return json(res, 404, { error: 'job not found' });
        return json(res, 200, {
          id: job.id,
          name: job.name,
          status: job.status,
          result: job.result,
          error: job.error
        });
      }

      if (parts.length === 4 && parts[3] === 'events' && method === 'GET') {
        const job = jobs.get(url.searchParams.get('job'));
        if (!job) return json(res, 404, { error: 'job not found' });
        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-store',
          connection: 'keep-alive'
        });
        const unsubscribe = jobs.subscribe(job.id, (event) => {
          res.write('data: ' + JSON.stringify(event) + '\n\n');
        });
        if (job.status !== 'running') {
          res.end();
          return undefined;
        }
        req.on('close', () => {
          if (typeof unsubscribe === 'function') unsubscribe();
        });
        return undefined;
      }

      if (parts.length === 4 && parts[3] === 'verify' && method === 'POST') {
        const state = workspace.state(id);
        if (!state || !fs.existsSync(workspace.paths(id).outDir)) {
          return json(res, 400, { error: 'nothing built yet' });
        }
        const report = verifyBuild({
          outDir: workspace.paths(id).outDir,
          domain: project.domain,
          keyPath: workspace.paths(id).keyPath
        });
        return json(res, 200, report);
      }

      if (parts.length === 4 && parts[3] === 'preview' && method === 'GET') {
        const urlPath = url.searchParams.get('path') || '/';
        const policy = workspace.policy(id);
        const state = workspace.state(id);
        const page = state && state.pages ? state.pages[urlPath] : null;
        let frontmatter = null;
        if (page && page.primary) {
          try {
            const text = fs.readFileSync(path.join(workspace.paths(id).outDir, page.primary), 'utf8');
            frontmatter = text.split('---').slice(1, 2).join('---').trim();
          } catch (error) {
            frontmatter = null;
          }
        }
        return json(res, 200, {
          path: urlPath,
          effective: policyLib.effectivePolicy(policy, urlPath),
          override: policyLib.resolveOverride(policy, urlPath),
          built: Boolean(page),
          frontmatter
        });
      }

      if (parts.length === 4 && parts[3] === 'export' && method === 'GET') {
        const paths = workspace.paths(id);
        let publicLines = [];
        try {
          publicLines = fs.readFileSync(paths.publicKeyPath, 'utf8').trim().split('\n');
        } catch (error) {
          publicLines = [];
        }
        const pk = publicLines[0] || '';
        const fp = publicLines[1] || '';
        return json(res, 200, {
          outDir: paths.outDir,
          domain: project.domain,
          dns: {
            name: '_aifeed.' + project.domain,
            type: 'TXT',
            value: 'v=aifeed1; pk=' + pk + '; fp=' + fp + '; manifest=https://' + project.domain + '/.well-known/ai.json'
          },
          stack: project.source && project.source.stack ? project.source.stack : null,
          adapter: project.source && project.source.stack && project.source.stack.adapter ? project.source.stack.adapter : null,
          instructions: ['upload_overlay', 'add_dns_txt', 'verify_live']
        });
      }

      if (parts.length === 4 && parts[3] === 'export.tar.gz' && method === 'GET') {
        const state = workspace.state(id);
        if (!state || !fs.existsSync(workspace.paths(id).outDir)) {
          return json(res, 400, { error: 'nothing built yet' });
        }
        const archive = createTarGz(workspace.paths(id).outDir);
        res.writeHead(200, {
          'content-type': 'application/gzip',
          'content-disposition': 'attachment; filename="aifeed-' + project.domain + '.tar.gz"',
          'content-length': archive.length,
          'cache-control': 'no-store'
        });
        res.end(archive);
        return undefined;
      }

      if (parts.length === 4 && parts[3] === 'verify-live' && method === 'POST') {
        try {
          return json(res, 200, await liveVerify({ domain: project.domain }));
        } catch (error) {
          return json(res, 502, { error: error.message });
        }
      }

      if (parts.length === 4 && parts[3] === 'rotation' && method === 'GET') {
        if (!workspace.state(id)) return json(res, 400, { error: 'nothing built yet' });
        return json(res, 200, manifestStatus(workspace.paths(id).outDir));
      }

      if (parts.length === 5 && parts[3] === 'rotation' && parts[4] === 'prepare' && method === 'POST') {
        if (!workspace.state(id)) return json(res, 400, { error: 'nothing built yet' });
        const body = await readBody(req);
        if (body.confirm !== true) return json(res, 400, { error: 'prepare requires { confirm: true }' });
        const paths = workspace.paths(id);
        try {
          const plan = prepareRotation({
            outDir: paths.outDir,
            workspaceDir: paths.dir,
            keyPath: paths.keyPath,
            windowHours: body.window,
            leadHours: body.lead
          });
          const overlap = JSON.parse(fs.readFileSync(path.join(paths.outDir, '.well-known', 'ai.json'), 'utf8'));
          project.rotation = overlap.rotation || null;
          workspace.saveProject(id, project);
          return json(res, 200, plan);
        } catch (error) {
          return json(res, 500, { error: error.message });
        }
      }

      if (parts.length === 5 && parts[3] === 'rotation' && parts[4] === 'cutover' && method === 'POST') {
        if (!workspace.state(id)) return json(res, 400, { error: 'nothing built yet' });
        const body = await readBody(req);
        if (body.confirm !== 'ROTATE') return json(res, 400, { error: 'cutover requires { confirm: "ROTATE" }' });
        const paths = workspace.paths(id);
        try {
          const plan = cutoverRotation({
            outDir: paths.outDir,
            workspaceDir: paths.dir,
            keyPath: paths.keyPath,
            publicKeyPath: paths.publicKeyPath
          });
          const cutoverManifest = JSON.parse(fs.readFileSync(path.join(paths.outDir, '.well-known', 'ai.json'), 'utf8'));
          project.rotation = cutoverManifest.rotation || null;
          workspace.saveProject(id, project);
          let sourceDir = null;
          let pages = null;
          let sitemap;
          if (project.source && project.source.type === 'local') {
            sourceDir = project.source.dir;
          } else if (project.source && project.source.type === 'crawl') {
            pages = loadCrawlPages(paths);
            sitemap = project.source.sitemap === true;
          }
          const rebuild = publishProject({
            project,
            policy: workspace.policy(id),
            sourceDir,
            pages,
            sitemap,
            pageTypes: project.page_types || [],
            freshness: project.freshness !== false,
            rotation: project.rotation || undefined,
            advanced: project.advanced || undefined,
            outDir: paths.outDir,
            keyPath: paths.keyPath,
            statePath: paths.statePath,
            incremental: false
          });
          return json(res, 200, { plan, rebuild: { total: rebuild.total, processed: rebuild.processed } });
        } catch (error) {
          return json(res, 500, { error: error.message });
        }
      }
    }

    return json(res, 404, { error: 'not found' });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) {
        const provided = req.headers['x-studio-token'] || url.searchParams.get('token');
        if (provided !== token) return json(res, 401, { error: 'unauthorized' });
        const result = await handleApi(req, res, url);
        if (result !== undefined) return result;
        return undefined;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method not allowed' });
      return serveStatic(res, url.pathname, token);
    } catch (error) {
      return json(res, 500, { error: error.message });
    }
  });

  return { server, workspace, token, jobs };
}

function main(argv) {
  const args = parseArgs(argv || process.argv.slice(2));
  const port = Number(args.port || 7777);
  const host = args.host || '127.0.0.1';
  const { server, workspace } = createServer({ workspace: args.workspace });
  server.listen(port, host, () => {
    process.stdout.write('AIFeed Studio ' + VERSION + '\n');
    process.stdout.write('Workspace : ' + workspace.root + '\n');
    process.stdout.write('URL       : http://' + host + ':' + port + '/\n');
    process.stdout.write('Stop with Ctrl+C\n');
  });
}

if (require.main === module) {
  main();
}

module.exports = { createServer, parseArgs };
