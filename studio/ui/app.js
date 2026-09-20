'use strict';

(function () {
  const TOKEN = window.__STUDIO_TOKEN__ || '';
  const USAGE_KEYS = ['search', 'retrieval', 'input', 'training', 'quote', 'summarize', 'reproduce', 'translate', 'modify', 'embed', 'commercial_use'];
  const TYPES = ['blog', 'news', 'ecommerce', 'marketplace', 'government', 'education', 'saas', 'portfolio', 'community', 'docs', 'nonprofit', 'personal', 'other'];
  const MAKO_TYPES = ['product', 'article', 'docs', 'landing', 'profile', 'listing', 'event', 'recipe', 'faq', 'custom'];
  const ATTRIBUTION_RANK = { none: 0, optional: 1, required: 2 };

  const state = {
    lang: localStorage.getItem('aifeed-studio-lang') || ((navigator.language || 'en').slice(0, 2)),
    i18n: {},
    presets: [],
    typePresets: {},
    view: 'projects',
    projects: [],
    current: null,
    tab: 'setup',
    policyDraft: null,
    pageTypesDraft: null,
    verifyReport: null,
    liveReport: null,
    rotationStatus: undefined,
    rotationMessage: null,
    exportInfo: null,
    log: [],
    busy: false
  };

  const app = document.getElementById('app');
  const toastEl = document.getElementById('toast');

  async function api(path, options = {}) {
    const response = await fetch('/api' + path, {
      ...options,
      headers: {
        'content-type': 'application/json',
        'x-studio-token': TOKEN,
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data.errors ? data.errors.join('; ') : data.error;
      throw new Error(detail || 'HTTP ' + response.status);
    }
    return data;
  }

  function t(key, vars) {
    const value = state.i18n[key] || key;
    return vars ? value.replace(/\{(\w+)\}/g, (match, name) => (vars[name] !== undefined ? vars[name] : match)) : value;
  }

  function esc(value) {
    return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  }

  let toastTimer = null;
  function showToast(message, ok) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    toastEl.className = 'toast' + (ok ? ' ok' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 4200);
  }

  const FAILURE_HINTS = [
    [/dns_mismatch/, 'diag.hint.dns'],
    [/schema_violation/, 'diag.hint.schema'],
    [/bad_signature/, 'diag.hint.signature'],
    [/rotation_|key_revoked/, 'diag.hint.rotation'],
    [/ENOENT|not found/, 'diag.hint.path']
  ];

  function fail(error) {
    let message = error && error.message ? error.message : String(error);
    const match = FAILURE_HINTS.find(([pattern]) => pattern.test(message));
    if (match) message += ' — ' + t(match[1]);
    showToast(t('common.error') + ': ' + message, false);
  }

  function option(value, label, selected) {
    return '<option value="' + esc(value) + '"' + (selected === value ? ' selected' : '') + '>' + esc(label) + '</option>';
  }

  async function loadI18n() {
    try {
      const response = await fetch('/i18n/' + state.lang + '.json');
      state.i18n = await response.json();
    } catch (error) {
      state.i18n = {};
    }
  }

  async function loadPresets() {
    try {
      const data = await api('/presets');
      state.presets = data.presets || [];
      state.typePresets = data.typePresets || {};
    } catch (error) {
      state.presets = [];
      state.typePresets = {};
    }
  }

  async function refreshProjects() {
    const data = await api('/projects');
    state.projects = data.projects;
  }

  function render() {
    document.getElementById('lang').value = ['en', 'id', 'zh'].includes(state.lang) ? state.lang : 'en';
    if (state.view === 'projects') renderProjects();
    else renderProject();
  }

  function renderProjects() {
    const items = state.projects.map((project) => {
      const built = project.built_at ? t('projects.built', { at: project.built_at.replace('T', ' ').replace('Z', '') }) : '';
      return '<div class="project-item" data-id="' + esc(project.id) + '">' +
        '<div><div class="dom">' + esc(project.domain) + '</div>' +
        '<div class="muted small">' + esc(project.name) + ' · ' + t('projects.pages', { count: project.pages }) +
        (built ? ' · ' + esc(built) : '') + '</div></div>' +
        '<div class="spacer"></div><button class="ghost">' + t('projects.open') + '</button></div>';
    }).join('');

    app.innerHTML =
      '<h1>' + t('projects.title') + '</h1>' +
      '<p class="muted">' + t('app.subtitle') + '</p>' +
      '<div class="card"><div class="projects">' + (items || '<p class="muted">' + t('projects.empty') + '</p>') + '</div></div>' +
      '<div class="card"><h2>' + t('new.title') + '</h2>' +
      '<div class="grid">' +
      field('n-domain', t('new.domain'), 'text', 'example.com') +
      field('n-name', t('new.name'), 'text', '') +
      '<div><label>' + t('new.type') + '</label><select id="n-type">' + TYPES.map((type) => option(type, type, 'blog')).join('') + '</select></div>' +
      '<div><label>' + t('new.preset') + '</label><select id="n-preset">' + presetOptions('blog') + '</select></div>' +
      field('n-locale', t('new.locale'), 'text', 'en') +
      field('n-contact', t('new.contact'), 'text', 'mailto:admin@example.com') +
      '<div><label>' + t('new.profile') + '</label><select id="n-profile">' +
      option('both', 'both', 'both') + option('aimd', 'aimd', 'both') + option('mako', 'mako', 'both') + '</select></div>' +
      '</div>' +
      '<div style="margin-top:12px"><label>' + t('new.description') + '</label><input id="n-description" type="text"></div>' +
      '<p style="margin-top:12px"><button class="primary" id="create">' + t('new.create') + '</button></p></div>';

    for (const element of app.querySelectorAll('.project-item')) {
      element.addEventListener('click', () => openProject(element.dataset.id));
    }
    document.getElementById('n-type').addEventListener('change', (event) => {
      document.getElementById('n-preset').value = (state.typePresets && state.typePresets[event.target.value]) || 'blog';
    });
    document.getElementById('create').addEventListener('click', async () => {
      try {
        const body = {
          domain: value('n-domain'),
          name: value('n-name'),
          type: value('n-type'),
          preset: value('n-preset'),
          locale: value('n-locale'),
          contact: value('n-contact'),
          description: value('n-description'),
          profile: value('n-profile')
        };
        const created = await api('/projects', { method: 'POST', body: JSON.stringify(body) });
        await refreshProjects();
        await openProject(created.project.id);
      } catch (error) {
        fail(error);
      }
    });
  }

  function field(id, label, type, placeholder) {
    return '<div><label>' + esc(label) + '</label><input id="' + id + '" type="' + type + '" placeholder="' + esc(placeholder) + '"></div>';
  }

  function value(id) {
    const element = document.getElementById(id);
    return element ? element.value.trim() : '';
  }

  function checked(id) {
    const element = document.getElementById(id);
    return element ? element.checked : false;
  }

  function number(id) {
    const raw = value(id);
    if (raw === '') return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
  }

  async function openProject(id) {
    try {
      const data = await api('/projects/' + id);
      state.current = data;
      state.policyDraft = JSON.parse(JSON.stringify(data.policy));
      state.pageTypesDraft = null;
      state.verifyReport = null;
      state.liveReport = null;
      state.rotationStatus = undefined;
      state.rotationMessage = null;
      state.tab = 'setup';
      state.exportInfo = null;
      state.log = [];
      state.view = 'project';
      render();
    } catch (error) {
      fail(error);
    }
  }

  function renderProject() {
    const project = state.current.project;
    const tabs = ['setup', 'policy', 'build', 'verify', 'export'];
    app.innerHTML =
      '<p><button class="ghost" id="back">← ' + t('common.back') + '</button></p>' +
      '<h1>' + esc(project.domain) + '</h1>' +
      '<p class="muted small">' + esc(project.name) + ' · ' + esc(project.profile) + ' · ' +
      t('setup.fingerprint') + ': <code>' + esc(state.current.fingerprint || '') + '</code></p>' +
      '<div class="tabs">' + tabs.map((tab) =>
        '<button data-tab="' + tab + '"' + (state.tab === tab ? ' class="active"' : '') + '>' + t('tabs.' + tab) + '</button>'
      ).join('') + '</div>' +
      '<div id="tab"></div>';

    document.getElementById('back').addEventListener('click', async () => {
      state.view = 'projects';
      await refreshProjects();
      render();
    });
    for (const button of app.querySelectorAll('[data-tab]')) {
      button.addEventListener('click', () => {
        state.tab = button.dataset.tab;
        render();
      });
    }
    if (state.tab === 'setup') renderSetup();
    else if (state.tab === 'policy') renderPolicy();
    else if (state.tab === 'build') renderBuild();
    else if (state.tab === 'verify') renderVerify();
    else if (state.tab === 'export') renderExport();
  }

  function renderSetup() {
    const data = state.current;
    const project = data.project;
    const tab = document.getElementById('tab');
    tab.innerHTML =
      '<div class="card"><h2>' + t('setup.identity') + '</h2><div class="grid">' +
      fieldValue('s-name', t('setup.name'), project.name) +
      '<div><label>' + t('setup.type') + '</label><select id="s-type">' + TYPES.map((type) => option(type, type, project.type)).join('') + '</select></div>' +
      fieldValue('s-locale', t('setup.locale'), project.locale) +
      fieldValue('s-contact', t('setup.contact'), project.contact) +
      '<div><label>' + t('setup.profile') + '</label><select id="s-profile">' +
      option('both', 'both', project.profile) + option('aimd', 'aimd', project.profile) + option('mako', 'mako', project.profile) + '</select></div>' +
      '</div>' +
      '<div style="margin-top:12px"><label>' + t('setup.description') + '</label><input id="s-description" type="text" value="' + esc(project.description || '') + '"></div>' +
      '<p class="muted small">' + t('setup.outDir') + ': <code>' + esc(data.outDir) + '</code></p>' +
      '<p style="margin-top:12px"><button class="primary" id="save-identity">' + t('setup.saveIdentity') + '</button></p></div>' +
      '<div class="card"><h2>' + t('setup.source') + '</h2>' +
      '<div class="grid"><div><label>' + t('setup.sourceType') + '</label><select id="s-source-type">' +
      option('local', t('setup.sourceType.local'), project.source ? project.source.type : 'local') +
      option('crawl', t('setup.sourceType.crawl'), project.source ? project.source.type : 'local') +
      '</select></div></div>' +
      '<div id="source-fields" style="margin-top:12px"></div>' +
      (project.source && project.source.pages ? '<p class="muted small">' + t('setup.scanStatus', { count: project.source.pages, at: project.source.last_scan || '' }) + '</p>' : '') +
      '<p style="margin-top:12px"><button id="save-source">' + t('setup.sourceSave') + '</button></p>' +
      '<p class="muted small">' + t('setup.keyNote') + '</p></div>';

    const sourceType = project.source ? project.source.type : 'local';
    renderSourceFields(sourceType);
    document.getElementById('s-source-type').addEventListener('change', (event) => {
      renderSourceFields(event.target.value);
    });

    document.getElementById('save-identity').addEventListener('click', async () => {
      try {
        const updated = await api('/projects/' + state.current.project.id, {
          method: 'PUT',
          body: JSON.stringify({
            name: value('s-name'),
            type: value('s-type'),
            locale: value('s-locale'),
            contact: value('s-contact'),
            description: value('s-description'),
            profile: value('s-profile')
          })
        });
        state.current.project = updated.project;
        showToast(t('common.saved'), true);
        render();
      } catch (error) {
        fail(error);
      }
    });
    document.getElementById('save-source').addEventListener('click', async () => {
      try {
        const type = value('s-source-type');
        const body = type === 'crawl' ? {
          type,
          origin: value('s-origin'),
          maxPages: number('s-max-pages') || 500,
          requestsPerSecond: number('s-rps') || 2,
          include: value('s-include'),
          exclude: value('s-exclude'),
          respectRobots: checked('s-respect-robots')
        } : {
          type,
          dir: value('s-source'),
          stack: value('s-stack') === 'auto' ? undefined : value('s-stack')
        };
        const result = await api('/projects/' + state.current.project.id + '/source', {
          method: 'PUT',
          body: JSON.stringify(body)
        });
        state.current.project.source = result.source;
        showToast(t('common.saved'), true);
        render();
      } catch (error) {
        fail(error);
      }
    });
  }

  function renderSourceFields(type) {
    const project = state.current.project;
    const source = project.source;
    const container = document.getElementById('source-fields');
    if (type === 'crawl') {
      container.innerHTML =
        '<div class="grid">' +
        '<div><label>' + t('setup.origin') + '</label><input id="s-origin" type="text" placeholder="https://' + esc(project.domain) + '" value="' + esc(source && source.type === 'crawl' ? source.origin : 'https://' + project.domain) + '"></div>' +
        '<div><label>' + t('setup.maxPages') + '</label><input id="s-max-pages" type="number" min="1" max="50000" value="' + esc(source && source.type === 'crawl' ? source.maxPages : 500) + '"></div>' +
        '<div><label>' + t('setup.requestsPerSecond') + '</label><input id="s-rps" type="number" min="0.1" step="0.1" value="' + esc(source && source.type === 'crawl' ? source.requestsPerSecond : 2) + '"></div>' +
        '<div><label>' + t('setup.include') + '</label><input id="s-include" type="text" placeholder="/blog,/docs" value="' + esc(source && source.type === 'crawl' ? (source.include || []).join(',') : '') + '"></div>' +
        '<div><label>' + t('setup.exclude') + '</label><input id="s-exclude" type="text" placeholder="/cart, /account" value="' + esc(source && source.type === 'crawl' ? (source.exclude || []).join(',') : '') + '"></div>' +
        '</div>' +
        '<label class="check" style="margin-top:10px"><input id="s-respect-robots" type="checkbox"' + (!source || source.type !== 'crawl' || source.respectRobots !== false ? ' checked' : '') + '> ' + t('setup.respectRobots') + '</label>';
      return;
    }
    container.innerHTML =
      '<div><label>' + t('setup.sourceDir') + '</label><input id="s-source" type="text" placeholder="C:\\\\sites\\\\example\\\\public" value="' + esc(source && source.type === 'local' ? source.dir : '') + '"></div>' +
      '<div style="margin-top:10px"><label>' + t('setup.stack') + '</label><select id="s-stack">' +
      ['auto', 'wordpress', 'nginx', 'caddy', 'apache', 'nextjs', 'node', 'php', 'python', 'go', 'cloudflare', 'unknown']
        .map((id) => option(id, id === 'auto' ? t('setup.stackAuto') : id, source && source.stack && source.type === 'local' ? source.stack.id : 'auto'))
        .join('') +
      '</select></div>';
  }

  function fieldValue(id, label, current) {
    return '<div><label>' + esc(label) + '</label><input id="' + id + '" type="text" value="' + esc(current) + '"></div>';
  }

  function renderPolicy() {
    const tab = document.getElementById('tab');
    const policy = state.policyDraft;
    if (!state.pageTypesDraft) {
      state.pageTypesDraft = JSON.parse(JSON.stringify(state.current.project.page_types || []));
    }
    const pageTypes = state.pageTypesDraft;
    const usageRows = USAGE_KEYS.map((key) =>
      '<div><label>' + t('usage.' + key) + '</label><select id="p-usage-' + key + '">' +
      option('allow', 'allow', policy.usage[key]) + option('deny', 'deny', policy.usage[key]) + '</select></div>'
    ).join('');

    const rules = (policy.rules || []).map((rule, index) => policyRule(rule, index, policy)).join('');
    tab.innerHTML =
      '<div class="card"><h2>' + t('policy.title') + '</h2><p class="muted small">' + t('policy.hint') + '</p>' +
      '<h2>' + t('policy.usage') + '</h2><div class="usage-grid">' + usageRows + '</div>' +
      '<h2>' + t('policy.attribution') + '</h2><div class="grid">' +
      '<div><label>' + t('policy.attribution') + '</label><select id="p-attribution">' +
      option('required', t('policy.attribution.required'), policy.attribution) +
      option('optional', t('policy.attribution.optional'), policy.attribution) +
      option('none', t('policy.attribution.none'), policy.attribution) + '</select></div>' +
      '<div><label>' + t('policy.attributionText') + '</label><input id="p-attribution-text" type="text" value="' + esc(policy.attribution_text || '') + '"></div>' +
      '<div><label>' + t('policy.attributionUrl') + '</label><input id="p-attribution-url" type="text" value="' + esc(policy.attribution_url || '') + '"></div>' +
      '</div>' +
      '<h2>' + t('policy.limits') + '</h2><div class="grid">' +
      '<div><label>' + t('policy.rpm') + '</label><input id="p-rpm" type="number" min="1" value="' + esc(policy.limits.requests_per_minute) + '"></div>' +
      '<div><label>' + t('policy.concurrent') + '</label><input id="p-concurrent" type="number" min="1" value="' + esc(policy.limits.concurrent) + '"></div>' +
      '<div><label>' + t('policy.delay') + '</label><input id="p-delay" type="number" min="0" value="' + esc(policy.limits.crawl_delay_seconds) + '"></div>' +
      '</div>' +
      '<h2>' + t('policy.license') + '</h2><div class="grid">' +
      '<div><label>' + t('policy.licenseName') + '</label><input id="p-license-name" type="text" value="' + esc(policy.license ? policy.license.name : '') + '"></div>' +
      '<div><label>' + t('policy.licenseUrl') + '</label><input id="p-license-url" type="text" value="' + esc(policy.license && policy.license.url ? policy.license.url : '') + '"></div>' +
      '<div><label>' + t('policy.rslUrl') + '</label><input id="p-rsl-url" type="text" value="' + esc(policy.license && policy.license.rsl_url ? policy.license.rsl_url : '') + '"></div>' +
      '</div>' +
      '<div class="inline" style="margin-top:12px">' +
      '<label class="check"><input id="p-llms" type="checkbox"' + (policy.llms ? ' checked' : '') + '> ' + t('policy.llms') + '</label>' +
      '<div><label>' + t('policy.interval') + '</label><input id="p-interval" type="number" min="1" max="8760" value="' + esc(policy.max_check_interval_hours) + '"></div>' +
      '</div></div>' +
      '<div class="card"><h2>' + t('policy.preset') + '</h2>' +
      '<div class="row"><div><select id="p-preset">' + presetOptions(state.current.project.preset) + '</select></div>' +
      '<div style="flex:0 0 auto"><button id="preset-apply">' + t('policy.applyPreset') + '</button></div></div></div>' +
      '<div class="card"><h2>' + t('policy.rules') + '</h2><div id="rules">' + rules + '</div>' +
      '<p><button class="ghost" id="rule-add">+ ' + t('policy.ruleAdd') + '</button></p>' +
      '<p><button class="primary" id="policy-save">' + t('policy.save') + '</button></p></div>' +
      '<div class="card"><h2>' + t('policy.content') + '</h2>' +
      '<label class="check"><input id="p-freshness" type="checkbox"' + (state.current.project.freshness !== false ? ' checked' : '') + '> ' + t('policy.freshness') + '</label>' +
      '<h2>' + t('policy.pageTypes') + '</h2><div id="page-types">' + pageTypes.map((entry, index) => pageTypeRow(entry, index)).join('') + '</div>' +
      '<p><button class="ghost" id="pt-add">+ ' + t('policy.pageTypeAdd') + '</button></p>' +
      '<p><button class="primary" id="pt-save">' + t('policy.saveContent') + '</button></p></div>' +
      '<div class="card"><h2>' + t('policy.advanced') + '</h2><p class="muted small">' + t('policy.advancedHint') + '</p>' +
      '<div class="grid">' +
      '<div><label>types</label><textarea id="adv-types" rows="5">' + esc(JSON.stringify((state.current.project.advanced && state.current.project.advanced.types) || {}, null, 2)) + '</textarea></div>' +
      '<div><label>capabilities</label><textarea id="adv-capabilities" rows="5">' + esc(JSON.stringify((state.current.project.advanced && state.current.project.advanced.capabilities) || {}, null, 2)) + '</textarea></div>' +
      '<div><label>actions</label><textarea id="adv-actions" rows="5">' + esc(JSON.stringify((state.current.project.advanced && state.current.project.advanced.actions) || {}, null, 2)) + '</textarea></div>' +
      '</div>' +
      '<p><button class="primary" id="advanced-save">' + t('policy.advancedSave') + '</button></p>' +
      '<h2>' + t('policy.openapiImport') + '</h2>' +
      '<textarea id="adv-openapi" rows="4" placeholder="{ &quot;openapi&quot;: &quot;3.0.0&quot;, &quot;paths&quot;: { ... } }"></textarea>' +
      '<p><button id="openapi-run">' + t('policy.openapiRun') + '</button></p></div>' +
      '<div class="card"><h2>' + t('policy.preview') + '</h2>' +
      '<div class="row"><div><label>' + t('policy.previewPath') + '</label><input id="preview-path" type="text" placeholder="/cart/checkout"></div>' +
      '<div style="flex:0 0 auto"><label>&nbsp;</label><button id="preview-run">' + t('policy.previewRun') + '</button></div></div>' +
      '<pre id="preview-out" hidden></pre></div>';

    for (const button of tab.querySelectorAll('[data-remove]')) {
      button.addEventListener('click', () => {
        state.policyDraft.rules.splice(Number(button.dataset.remove), 1);
        render();
      });
    }
    document.getElementById('rule-add').addEventListener('click', () => {
      state.policyDraft = collectPolicy();
      state.policyDraft.rules.push({ pattern: '/' });
      render();
    });
    document.getElementById('policy-save').addEventListener('click', async () => {
      try {
        const policy = collectPolicy();
        const saved = await api('/projects/' + state.current.project.id + '/policy', {
          method: 'PUT',
          body: JSON.stringify({ policy })
        });
        state.policyDraft = saved.policy;
        state.current.policy = saved.policy;
        showToast(t('common.saved'), true);
        render();
      } catch (error) {
        fail(error);
      }
    });
    document.getElementById('preview-run').addEventListener('click', async () => {
      try {
        const result = await api('/projects/' + state.current.project.id + '/preview?path=' + encodeURIComponent(value('preview-path') || '/'));
        const out = document.getElementById('preview-out');
        out.hidden = false;
        out.textContent = JSON.stringify({ override: result.override, effective: result.effective }, null, 2);
      } catch (error) {
        fail(error);
      }
    });
    document.getElementById('preset-apply').addEventListener('click', () => {
      const preset = state.presets.find((entry) => entry.name === value('p-preset'));
      if (!preset) return;
      state.policyDraft = JSON.parse(JSON.stringify(preset.policy));
      render();
    });
    for (const button of tab.querySelectorAll('[data-pt-remove]')) {
      button.addEventListener('click', () => {
        state.pageTypesDraft = collectPageTypes();
        state.pageTypesDraft.splice(Number(button.dataset.ptRemove), 1);
        render();
      });
    }
    document.getElementById('pt-add').addEventListener('click', () => {
      state.pageTypesDraft = collectPageTypes();
      state.pageTypesDraft.push({ pattern: '/products/**', type: 'product' });
      render();
    });
    document.getElementById('pt-save').addEventListener('click', async () => {
      try {
        const updated = await api('/projects/' + state.current.project.id, {
          method: 'PUT',
          body: JSON.stringify({
            page_types: collectPageTypes(),
            freshness: checked('p-freshness')
          })
        });
        state.current.project = updated.project;
        state.pageTypesDraft = JSON.parse(JSON.stringify(updated.project.page_types || []));
        showToast(t('common.saved'), true);
        render();
      } catch (error) {
        fail(error);
      }
    });
    document.getElementById('advanced-save').addEventListener('click', async () => {
      try {
        const advanced = {
          types: parseJsonArea('adv-types', 'types'),
          capabilities: parseJsonArea('adv-capabilities', 'capabilities'),
          actions: parseJsonArea('adv-actions', 'actions')
        };
        const saved = await api('/projects/' + state.current.project.id + '/advanced', {
          method: 'PUT',
          body: JSON.stringify({ advanced })
        });
        state.current.project.advanced = saved.advanced;
        showToast(t('common.saved'), true);
        render();
      } catch (error) {
        fail(error);
      }
    });
    document.getElementById('openapi-run').addEventListener('click', async () => {
      try {
        const spec = parseJsonArea('adv-openapi', 'OpenAPI');
        const result = await api('/projects/' + state.current.project.id + '/advanced/import-openapi', {
          method: 'POST',
          body: JSON.stringify({ spec })
        });
        const merge = (current, incoming) => JSON.stringify({ ...current, ...incoming }, null, 2);
        document.getElementById('adv-types').value = merge(parseJsonArea('adv-types', 'types'), result.fragment.types || {});
        document.getElementById('adv-capabilities').value = merge(parseJsonArea('adv-capabilities', 'capabilities'), result.fragment.capabilities || {});
        document.getElementById('adv-actions').value = merge(parseJsonArea('adv-actions', 'actions'), result.fragment.actions || {});
        showToast(t('policy.imported', {
          capabilities: result.stats.capabilities,
          actions: result.stats.actions
        }), true);
      } catch (error) {
        fail(error);
      }
    });
  }

  function parseJsonArea(id, label) {
    const raw = value(id);
    if (raw === '') return {};
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(label + ': invalid JSON');
    }
  }

  function presetOptions(selected) {
    const names = state.presets.length > 0
      ? state.presets.map((entry) => entry.name)
      : ['blog', 'news', 'ecommerce', 'marketplace', 'government', 'open', 'restrictive'];
    return names.map((name) => option(name, name, selected)).join('');
  }

  function pageTypeRow(entry, index) {
    return '<div class="rule"><div class="row">' +
      '<div><label>' + t('policy.pageTypePattern') + '</label><input id="pt-' + index + '-pattern" type="text" value="' + esc(entry.pattern || '') + '"></div>' +
      '<div><label>' + t('policy.pageTypeType') + '</label><select id="pt-' + index + '-type">' + MAKO_TYPES.map((type) => option(type, type, entry.type)).join('') + '</select></div>' +
      '<div style="flex:0 0 auto"><label>&nbsp;</label><button class="ghost" data-pt-remove="' + index + '">' + t('policy.pageTypeRemove') + '</button></div>' +
      '</div></div>';
  }

  function collectPageTypes() {
    return (state.pageTypesDraft || []).map((entry, index) => ({
      pattern: value('pt-' + index + '-pattern'),
      type: value('pt-' + index + '-type')
    })).filter((entry) => entry.pattern);
  }

  function policyRule(rule, index, policy) {
    const denyBoxes = USAGE_KEYS.map((key) => {
      const on = rule.usage && rule.usage[key] === 'deny';
      return '<label class="check"><input type="checkbox" id="r-' + index + '-deny-' + key + '"' + (on ? ' checked' : '') + '> ' + t('usage.' + key) + '</label>';
    }).join('');
    const globalRank = ATTRIBUTION_RANK[policy.attribution];
    const attrOptions = ['none', 'optional', 'required']
      .filter((level) => ATTRIBUTION_RANK[level] >= globalRank)
      .map((level) => option(level, t('policy.attribution.' + level), rule.attribution || ''))
      .join('');
    const licenseField = policy.license ? '' :
      '<div><label>' + t('policy.licenseName') + '</label><input id="r-' + index + '-license" type="text" value="' + esc(rule.license ? rule.license.name : '') + '"></div>';
    return '<div class="rule">' +
      '<div class="row"><div><label>' + t('policy.rulePattern') + '</label><input id="r-' + index + '-pattern" type="text" value="' + esc(rule.pattern || '') + '"></div>' +
      '<div style="flex:0 0 auto"><label>&nbsp;</label><button class="ghost" data-remove="' + index + '">' + t('policy.ruleRemove') + '</button></div></div>' +
      '<div style="margin-top:10px"><label>' + t('policy.ruleDeny') + '</label><div class="usage-grid">' + denyBoxes + '</div></div>' +
      '<div class="grid" style="margin-top:10px">' +
      '<div><label>' + t('policy.ruleAttribution') + '</label><select id="r-' + index + '-attribution">' +
      '<option value="">' + t('policy.inherit') + '</option>' + attrOptions + '</select></div>' +
      '<div><label>' + t('policy.rpm') + '</label><input id="r-' + index + '-rpm" type="number" min="1" value="' + (rule.limits && rule.limits.requests_per_minute ? esc(rule.limits.requests_per_minute) : '') + '"></div>' +
      '<div><label>' + t('policy.concurrent') + '</label><input id="r-' + index + '-concurrent" type="number" min="1" value="' + (rule.limits && rule.limits.concurrent ? esc(rule.limits.concurrent) : '') + '"></div>' +
      '<div><label>' + t('policy.delay') + '</label><input id="r-' + index + '-delay" type="number" min="0" value="' + (rule.limits && rule.limits.crawl_delay_seconds ? esc(rule.limits.crawl_delay_seconds) : '') + '"></div>' +
      licenseField + '</div></div>';
  }

  function collectPolicy() {
    const policy = {
      usage: {},
      attribution: value('p-attribution'),
      attribution_text: value('p-attribution-text'),
      attribution_url: value('p-attribution-url'),
      limits: {
        requests_per_minute: number('p-rpm') || 60,
        concurrent: number('p-concurrent') || 2,
        crawl_delay_seconds: number('p-delay') === undefined ? 1 : number('p-delay')
      },
      license: value('p-license-name') ? {
        name: value('p-license-name'),
        url: value('p-license-url') || undefined,
        rsl_url: value('p-rsl-url') || undefined
      } : null,
      max_check_interval_hours: number('p-interval') || 24,
      llms: checked('p-llms'),
      rules: state.policyDraft.rules.map((rule, index) => {
        const collected = { pattern: value('r-' + index + '-pattern') };
        const usage = {};
        for (const key of USAGE_KEYS) {
          if (checked('r-' + index + '-deny-' + key)) usage[key] = 'deny';
        }
        if (Object.keys(usage).length > 0) collected.usage = usage;
        const attribution = value('r-' + index + '-attribution');
        if (attribution) collected.attribution = attribution;
        const limits = {};
        const rpm = number('r-' + index + '-rpm');
        const concurrent = number('r-' + index + '-concurrent');
        const delay = number('r-' + index + '-delay');
        if (rpm !== undefined) limits.requests_per_minute = rpm;
        if (concurrent !== undefined) limits.concurrent = concurrent;
        if (delay !== undefined) limits.crawl_delay_seconds = delay;
        if (Object.keys(limits).length > 0) collected.limits = limits;
        const licenseName = value('r-' + index + '-license');
        if (licenseName) collected.license = { name: licenseName };
        return collected;
      })
    };
    for (const key of USAGE_KEYS) policy.usage[key] = value('p-usage-' + key);
    return policy;
  }

  function renderBuild() {
    const tab = document.getElementById('tab');
    const project = state.current.project;
    const source = project.source;
    const isCrawl = Boolean(source && source.type === 'crawl');
    tab.innerHTML =
      '<div class="card"><h2>' + t('build.title') + '</h2>' +
      (source ? '' : '<p class="muted">' + t('build.needSource') + '</p>') +
      '<p>' +
      (isCrawl ? '<button id="scan-start">' + t('build.scan') + '</button> ' : '') +
      '<button class="primary" id="build-start"' + (source ? '' : ' disabled') + '>' + t('build.start') + '</button></p>' +
      '<pre id="build-log">' + esc(state.log.join('\n')) + '</pre></div>';
    if (isCrawl) document.getElementById('scan-start').addEventListener('click', startScan);
    document.getElementById('build-start').addEventListener('click', startBuild);
  }

  function logLine(text) {
    state.log.push(text);
    const element = document.getElementById('build-log');
    if (element) element.textContent = state.log.join('\n');
  }

  async function runJob(jobPath, onDone) {
    try {
      const { jobId } = await api('/projects/' + state.current.project.id + jobPath, { method: 'POST' });
      logLine('job ' + jobId);
      const events = new EventSource('/api/projects/' + state.current.project.id + '/events?job=' + jobId + '&token=' + encodeURIComponent(TOKEN));
      events.onmessage = (message) => {
        const event = JSON.parse(message.data);
        if (event.type === 'progress') {
          logLine('[' + event.phase + '] ' + event.done + '/' + event.total + ' ' + (event.current || ''));
        } else if (event.type === 'done') {
          events.close();
          onDone(event.result);
        } else if (event.type === 'error') {
          events.close();
          logLine('error: ' + event.message);
          showToast(event.message, false);
        }
      };
      events.onerror = () => events.close();
    } catch (error) {
      fail(error);
    }
  }

  async function startScan() {
    await runJob('/scan', async (stats) => {
      const message = t('build.scanDone', {
        fetched: stats.fetched,
        unchanged: stats.unchanged,
        robots: stats.skippedRobots,
        errors: stats.errors
      });
      logLine(message);
      showToast(message, true);
      await openProject(state.current.project.id);
      state.tab = 'build';
      render();
    });
  }

  async function startBuild() {
    await runJob('/build', async (result) => {
      const assets = result.assets ? ', ' + t('build.assets') + ': ' + result.assets.total +
        ' (' + t('build.assetsHashed') + ': ' + result.assets.hashed + ')' : '';
      logLine(t('build.done') + ' — ' + t('build.total') + ': ' + result.total + ', ' +
        t('build.processed') + ': ' + result.processed + ', ' + t('build.skipped') + ': ' + result.skipped +
        ', ' + t('build.warnings') + ': ' + result.warnings.length + assets);
      showToast(t('build.done'), true);
      await openProject(state.current.project.id);
      state.tab = 'build';
      render();
    });
  }

  function renderVerify() {
    const tab = document.getElementById('tab');
    const report = state.verifyReport;
    let body = '<p><button class="primary" id="verify-run">' + t('verify.run') + '</button></p>';
    if (state.current.state === null) body += '<p class="muted">' + t('verify.none') + '</p>';
    if (report) {
      body += '<table>' +
        row(t('verify.result'), pill(report.result)) +
        row(t('verify.manifest'), pill(report.manifest.result) + (report.manifest.errors.length ? ' ' + esc(report.manifest.errors.map((error) => error.code).join(', ')) : '')) +
        row(t('verify.pages'), report.pages.total + ' · ok ' + report.pages.ok + ' · fail ' + report.pages.failed.length) +
        (report.assets ? row(t('verify.assets'), report.assets.total + ' (' + t('build.assetsHashed') + ': ' + report.assets.hashed + ')') : '') +
        row(t('verify.indexes'), report.indexes.map((entry) => entry.file + ' ' + (entry.ok ? 'ok' : 'fail')).join(', ') || '—') +
        '</table>';
      if (report.pages.failed.length > 0) {
        body += '<h2>' + t('verify.failed') + '</h2><pre>' + esc(JSON.stringify(report.pages.failed, null, 2)) + '</pre>';
      }
    }
    body += '<h2>' + t('verify.live') + '</h2><p><button id="verify-live-run">' + t('verify.liveRun') + '</button></p>';
    if (state.liveReport) {
      body += '<table>' +
        row(t('verify.result'), pill(state.liveReport.result)) +
        row(t('verify.dns'), state.liveReport.dns_anchored === null ? '—' : String(state.liveReport.dns_anchored)) +
        row(t('verify.failed'), state.liveReport.errors.length === 0 ? '—' : esc(state.liveReport.errors.map((entry) => entry.code).join(', '))) +
        '</table>';
    }
    body += '<h2>' + t('rotation.title') + '</h2>' +
      '<p class="muted small">' + t('rotation.status') + ': <code>' +
      esc(state.rotationStatus && state.rotationStatus.phase ? state.rotationStatus.phase : (state.rotationStatus ? '—' : '…')) + '</code></p>' +
      '<div class="grid">' +
      '<div><label>' + t('rotation.window') + '</label><input id="rotation-window" type="number" min="1" value="72"></div>' +
      '<div><label>' + t('rotation.prepare') + '</label><label class="check"><input id="rotation-prepare-confirm" type="checkbox"> ' + t('rotation.confirmPrepare') + '</label></div>' +
      '<div><label>' + t('rotation.confirmCutover') + '</label><input id="rotation-cutover-confirm" type="text" placeholder="ROTATE"></div>' +
      '</div>' +
      '<p><button id="rotation-prepare">' + t('rotation.prepare') + '</button> ' +
      '<button id="rotation-cutover">' + t('rotation.cutover') + '</button></p>' +
      (state.rotationMessage ? '<pre>' + esc(state.rotationMessage) + '</pre>' : '');
    tab.innerHTML = '<div class="card"><h2>' + t('verify.title') + '</h2>' + body + '</div>';
    if (state.rotationStatus === undefined) {
      state.rotationStatus = null;
      loadRotationStatus();
    }
    document.getElementById('verify-run').addEventListener('click', async () => {
      try {
        state.verifyReport = await api('/projects/' + state.current.project.id + '/verify', { method: 'POST' });
        render();
      } catch (error) {
        fail(error);
      }
    });
    document.getElementById('verify-live-run').addEventListener('click', async () => {
      try {
        state.liveReport = await api('/projects/' + state.current.project.id + '/verify-live', { method: 'POST' });
        render();
      } catch (error) {
        fail(error);
      }
    });
    document.getElementById('rotation-prepare').addEventListener('click', async () => {
      if (!checked('rotation-prepare-confirm')) {
        showToast(t('rotation.confirmPrepare'), false);
        return;
      }
      try {
        const plan = await api('/projects/' + state.current.project.id + '/rotation/prepare', {
          method: 'POST',
          body: JSON.stringify({ confirm: true, window: number('rotation-window') || 72, lead: 0 })
        });
        state.rotationMessage = JSON.stringify({
          successor_fingerprint: plan.successor_fingerprint,
          effective_at: plan.effective_at,
          grace_until: plan.grace_until,
          dns_txt: plan.dns_txt
        }, null, 2);
        await loadRotationStatus();
      } catch (error) {
        fail(error);
      }
    });
    document.getElementById('rotation-cutover').addEventListener('click', async () => {
      if (value('rotation-cutover-confirm') !== 'ROTATE') {
        showToast(t('rotation.confirmCutover'), false);
        return;
      }
      try {
        const result = await api('/projects/' + state.current.project.id + '/rotation/cutover', {
          method: 'POST',
          body: JSON.stringify({ confirm: 'ROTATE' })
        });
        state.rotationMessage = t('rotation.done') + ' — ' + t('build.total') + ': ' + result.rebuild.total;
        state.verifyReport = null;
        await loadRotationStatus();
      } catch (error) {
        fail(error);
      }
    });
  }

  async function loadRotationStatus() {
    try {
      state.rotationStatus = await api('/projects/' + state.current.project.id + '/rotation');
    } catch (error) {
      state.rotationStatus = null;
    }
    render();
  }

  function row(label, valueHtml) {
    return '<tr><th>' + esc(label) + '</th><td>' + valueHtml + '</td></tr>';
  }

  function pill(text) {
    const cls = text === 'VERIFIED' ? 'ok' : text === 'UNVERIFIED' ? 'bad' : 'warn';
    return '<span class="pill ' + cls + '">' + esc(text) + '</span>';
  }

  function renderExport() {
    const tab = document.getElementById('tab');
    tab.innerHTML = '<div class="card"><h2>' + t('export.title') + '</h2><p class="muted">' + t('common.loading') + '</p></div>';
    api('/projects/' + state.current.project.id + '/export').then((info) => {
      state.exportInfo = info;
      const steps = info.instructions.map((code) => {
        if (code === 'verify_live') return t('export.step.' + code, { domain: info.domain });
        return t('export.step.' + code);
      }).map((line) => '<li>' + esc(line) + '</li>').join('');
      tab.innerHTML =
        '<div class="card"><h2>' + t('export.title') + '</h2>' +
        '<p>' + t('export.outDir') + ':</p><pre>' + esc(info.outDir) + '</pre>' +
        '<h2>' + t('export.dns') + '</h2><pre id="dns">' + esc(info.dns.name + ' ' + info.dns.type + ' "' + info.dns.value + '"') + '</pre>' +
        '<p><button class="ghost" id="copy-dns">' + t('common.copy') + '</button></p>' +
        '<ol>' + steps + '</ol>' +
        '<p><a class="button" href="/api/projects/' + state.current.project.id + '/export.tar.gz?token=' + encodeURIComponent(TOKEN) + '">' + t('export.download') + '</a></p>' +
        (info.stack ? '<p class="muted small">' + t('export.stack') + ': <code>' + esc(info.stack.id) + '</code>' + (info.adapter ? ' · ' + esc(t('export.adapterHint', { adapter: info.adapter })) : '') + '</p>' : '') +
        '<p class="muted small">' + t('export.adapter') + '</p></div>';
      document.getElementById('copy-dns').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(info.dns.value);
          showToast(t('common.copied'), true);
        } catch (error) {
          fail(error);
        }
      });
    }).catch(fail);
  }

  document.getElementById('lang').addEventListener('change', async (event) => {
    state.lang = event.target.value;
    localStorage.setItem('aifeed-studio-lang', state.lang);
    await loadI18n();
    render();
  });

  (async () => {
    if (!['en', 'id', 'zh'].includes(state.lang)) state.lang = 'en';
    await loadI18n();
    await loadPresets();
    try {
      await refreshProjects();
    } catch (error) {
      fail(error);
    }
    render();
  })();
})();
