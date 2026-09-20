'use strict';

const { MAKO_TYPES } = require('../../lib/mako-html');

const USAGE_KEYS = [
  'search',
  'retrieval',
  'input',
  'training',
  'quote',
  'summarize',
  'reproduce',
  'translate',
  'modify',
  'embed',
  'commercial_use'
];

const ATTRIBUTION_RANK = { none: 0, optional: 1, required: 2 };
const LIMIT_KEYS = ['requests_per_minute', 'concurrent', 'crawl_delay_seconds'];
const RULE_FIELDS = ['pattern', 'usage', 'attribution', 'attribution_text', 'attribution_url', 'limits', 'license'];

const DEFAULT_POLICY = {
  usage: {
    search: 'allow',
    retrieval: 'allow',
    input: 'allow',
    training: 'deny',
    quote: 'allow',
    summarize: 'allow',
    reproduce: 'deny',
    translate: 'allow',
    modify: 'deny',
    embed: 'deny',
    commercial_use: 'deny'
  },
  attribution: 'required',
  attribution_text: '',
  attribution_url: '',
  limits: { requests_per_minute: 60, concurrent: 2, crawl_delay_seconds: 1 },
  license: null,
  max_check_interval_hours: 24,
  llms: true,
  rules: []
};

const HTTPS_PATTERN = /^https:\/\/\S+$/;

function normalizePolicy(input) {
  const policy = input && typeof input === 'object' ? input : {};
  const usage = { ...DEFAULT_POLICY.usage };
  if (policy.usage && typeof policy.usage === 'object') {
    for (const key of USAGE_KEYS) {
      if (policy.usage[key] === 'allow' || policy.usage[key] === 'deny') usage[key] = policy.usage[key];
    }
  }
  const limits = { ...DEFAULT_POLICY.limits };
  if (policy.limits && typeof policy.limits === 'object') {
    for (const key of LIMIT_KEYS) {
      if (Number.isInteger(policy.limits[key])) limits[key] = policy.limits[key];
    }
  }
  let license = null;
  if (policy.license && typeof policy.license === 'object' && typeof policy.license.name === 'string') {
    license = { name: policy.license.name };
    if (policy.license.url) license.url = policy.license.url;
    if (policy.license.rsl_url) license.rsl_url = policy.license.rsl_url;
  }
  return {
    usage,
    attribution: ATTRIBUTION_RANK[policy.attribution] !== undefined ? policy.attribution : DEFAULT_POLICY.attribution,
    attribution_text: typeof policy.attribution_text === 'string' ? policy.attribution_text : '',
    attribution_url: typeof policy.attribution_url === 'string' ? policy.attribution_url : '',
    limits,
    license,
    max_check_interval_hours: Number.isInteger(policy.max_check_interval_hours)
      ? policy.max_check_interval_hours
      : DEFAULT_POLICY.max_check_interval_hours,
    llms: policy.llms !== false,
    rules: Array.isArray(policy.rules) ? policy.rules : []
  };
}

function validatePolicy(input) {
  const errors = [];
  const policy = normalizePolicy(input);
  if (input && input.usage && typeof input.usage === 'object') {
    for (const [key, value] of Object.entries(input.usage)) {
      if (!USAGE_KEYS.includes(key)) errors.push('unknown usage key: ' + key);
      else if (value !== 'allow' && value !== 'deny') errors.push('usage.' + key + ' must be allow or deny');
    }
  }
  if (policy.attribution_text.length > 256) errors.push('attribution_text must be at most 256 characters');
  if (policy.attribution_url && !HTTPS_PATTERN.test(policy.attribution_url)) {
    errors.push('attribution_url must be an https URL');
  }
  if (input && input.limits) {
    const { requests_per_minute: rpm, concurrent, crawl_delay_seconds: delay } = policy.limits;
    if (rpm < 1 || rpm > 1000000) errors.push('limits.requests_per_minute must be 1..1000000');
    if (concurrent < 1 || concurrent > 1000) errors.push('limits.concurrent must be 1..1000');
    if (delay < 0 || delay > 3600) errors.push('limits.crawl_delay_seconds must be 0..3600');
  }
  if (policy.max_check_interval_hours < 1 || policy.max_check_interval_hours > 8760) {
    errors.push('max_check_interval_hours must be 1..8760');
  }
  if (policy.license) {
    if (policy.license.name.length === 0 || policy.license.name.length > 128) {
      errors.push('license.name must be 1..128 characters');
    }
    if (policy.license.url && !HTTPS_PATTERN.test(policy.license.url)) errors.push('license.url must be an https URL');
    if (policy.license.rsl_url && !HTTPS_PATTERN.test(policy.license.rsl_url)) {
      errors.push('license.rsl_url must be an https URL');
    }
  }
  errors.push(...validateRules(policy));
  return errors;
}

function matchPath(pattern, urlPath) {
  const escapedBase = (base) => base.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  if (pattern.endsWith('/**')) {
    const base = pattern.slice(0, -3);
    return new RegExp('^' + escapedBase(base) + '(?:/.*)?$').test(urlPath);
  }
  let source = '^';
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index];
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        source += '.*';
        index++;
      } else {
        source += '[^/]*';
      }
      continue;
    }
    source += escapedBase(char);
  }
  return new RegExp(source + '$').test(urlPath);
}

function ruleErrors(rule, global) {
  const errors = [];
  if (!rule || typeof rule !== 'object') return ['rule must be an object'];
  if (typeof rule.pattern !== 'string' || !rule.pattern.startsWith('/')) {
    errors.push('rule pattern must start with "/"');
  } else if (rule.pattern.length > 512 || rule.pattern.includes('..')) {
    errors.push('rule pattern is invalid: ' + rule.pattern);
  }
  for (const key of Object.keys(rule)) {
    if (!RULE_FIELDS.includes(key)) errors.push('unknown rule field: ' + key);
  }
  if (rule.usage !== undefined) {
    if (!rule.usage || typeof rule.usage !== 'object') {
      errors.push('rule usage must be an object');
    } else {
      for (const [key, value] of Object.entries(rule.usage)) {
        if (!USAGE_KEYS.includes(key)) errors.push('unknown rule usage key: ' + key);
        else if (value !== 'allow' && value !== 'deny') errors.push('rule usage.' + key + ' must be allow or deny');
        else if (global.usage[key] === 'deny' && value === 'allow') {
          errors.push('rule cannot loosen usage.' + key + ' (deny -> allow)');
        }
      }
    }
  }
  if (rule.attribution !== undefined) {
    if (ATTRIBUTION_RANK[rule.attribution] === undefined) {
      errors.push('rule attribution must be required, optional, or none');
    } else if (ATTRIBUTION_RANK[rule.attribution] < ATTRIBUTION_RANK[global.attribution]) {
      errors.push('rule cannot loosen attribution (' + global.attribution + ' -> ' + rule.attribution + ')');
    }
  }
  if (rule.attribution_text !== undefined && typeof rule.attribution_text !== 'string') {
    errors.push('rule attribution_text must be a string');
  } else if (typeof rule.attribution_text === 'string' && rule.attribution_text.length > 256) {
    errors.push('rule attribution_text must be at most 256 characters');
  }
  if (rule.attribution_url !== undefined) {
    if (typeof rule.attribution_url !== 'string' || !HTTPS_PATTERN.test(rule.attribution_url)) {
      errors.push('rule attribution_url must be an https URL');
    }
  }
  if (rule.limits !== undefined) {
    if (!rule.limits || typeof rule.limits !== 'object') {
      errors.push('rule limits must be an object');
    } else {
      for (const [key, value] of Object.entries(rule.limits)) {
        if (!LIMIT_KEYS.includes(key)) errors.push('unknown rule limit: ' + key);
        else if (!Number.isInteger(value)) errors.push('rule limit ' + key + ' must be an integer');
      }
      const { requests_per_minute: rpm, concurrent, crawl_delay_seconds: delay } = rule.limits;
      if (Number.isInteger(rpm) && rpm > global.limits.requests_per_minute) {
        errors.push('rule cannot raise requests_per_minute above the global limit');
      }
      if (Number.isInteger(concurrent) && concurrent > global.limits.concurrent) {
        errors.push('rule cannot raise concurrent above the global limit');
      }
      if (Number.isInteger(delay) && delay < global.limits.crawl_delay_seconds) {
        errors.push('rule cannot lower crawl_delay_seconds below the global limit');
      }
    }
  }
  if (rule.license !== undefined) {
    if (global.license) {
      errors.push('rule cannot replace the manifest license');
    } else if (!rule.license || typeof rule.license !== 'object' || typeof rule.license.name !== 'string') {
      errors.push('rule license requires a name');
    }
  }
  return errors;
}

function validateRules(policy) {
  const errors = [];
  if (!Array.isArray(policy.rules)) return ['rules must be an array'];
  policy.rules.forEach((rule, index) => {
    for (const message of ruleErrors(rule, policy)) errors.push('rules[' + index + ']: ' + message);
  });
  return errors;
}

function effectivePolicy(policy, urlPath) {
  const effective = {
    usage: { ...policy.usage },
    attribution: policy.attribution,
    attribution_text: policy.attribution_text,
    attribution_url: policy.attribution_url,
    limits: { ...policy.limits },
    license: policy.license
  };
  for (const rule of policy.rules) {
    if (typeof rule.pattern !== 'string' || !matchPath(rule.pattern, urlPath)) continue;
    if (rule.usage) {
      for (const [key, value] of Object.entries(rule.usage)) {
        if (value === 'deny') effective.usage[key] = 'deny';
      }
    }
    if (rule.attribution && ATTRIBUTION_RANK[rule.attribution] > ATTRIBUTION_RANK[effective.attribution]) {
      effective.attribution = rule.attribution;
    }
    if (typeof rule.attribution_text === 'string' && rule.attribution_text) {
      effective.attribution_text = rule.attribution_text;
    }
    if (typeof rule.attribution_url === 'string' && rule.attribution_url) {
      effective.attribution_url = rule.attribution_url;
    }
    if (rule.limits) {
      const rpm = rule.limits.requests_per_minute;
      const concurrent = rule.limits.concurrent;
      const delay = rule.limits.crawl_delay_seconds;
      if (Number.isInteger(rpm) && rpm < effective.limits.requests_per_minute) effective.limits.requests_per_minute = rpm;
      if (Number.isInteger(concurrent) && concurrent < effective.limits.concurrent) effective.limits.concurrent = concurrent;
      if (Number.isInteger(delay) && delay > effective.limits.crawl_delay_seconds) effective.limits.crawl_delay_seconds = delay;
    }
    if (!effective.license && rule.license) effective.license = rule.license;
  }
  return effective;
}

function resolveOverride(policy, urlPath) {
  if (policy.rules.length === 0) return null;
  const effective = effectivePolicy(policy, urlPath);
  const override = {};
  const usage = {};
  for (const key of USAGE_KEYS) {
    if (effective.usage[key] !== policy.usage[key]) usage[key] = effective.usage[key];
  }
  if (Object.keys(usage).length > 0) override.usage = usage;
  if (ATTRIBUTION_RANK[effective.attribution] > ATTRIBUTION_RANK[policy.attribution]) {
    override.attribution = effective.attribution;
  }
  if (effective.attribution_text && effective.attribution_text !== policy.attribution_text) {
    override.attribution_text = effective.attribution_text;
  }
  if (effective.attribution_url && effective.attribution_url !== policy.attribution_url) {
    override.attribution_url = effective.attribution_url;
  }
  const limits = {};
  for (const key of LIMIT_KEYS) {
    if (effective.limits[key] !== policy.limits[key]) limits[key] = effective.limits[key];
  }
  if (Object.keys(limits).length > 0) override.limits = limits;
  if (!policy.license && effective.license) override.license = effective.license;
  return Object.keys(override).length > 0 ? override : null;
}

function validatePageTypes(pageTypes) {
  const errors = [];
  if (!Array.isArray(pageTypes)) return ['page_types must be an array'];
  if (pageTypes.length > 100) errors.push('page_types supports at most 100 entries');
  pageTypes.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      errors.push('page_types[' + index + '] must be an object');
      return;
    }
    if (typeof entry.pattern !== 'string' || !entry.pattern.startsWith('/')) {
      errors.push('page_types[' + index + '].pattern must start with "/"');
    } else if (entry.pattern.length > 512 || entry.pattern.includes('..')) {
      errors.push('page_types[' + index + '].pattern is invalid');
    }
    if (!MAKO_TYPES.includes(entry.type)) {
      errors.push('page_types[' + index + '].type must be one of ' + MAKO_TYPES.join(', '));
    }
    for (const key of Object.keys(entry)) {
      if (key !== 'pattern' && key !== 'type') errors.push('page_types[' + index + '] unknown field: ' + key);
    }
  });
  return errors;
}

function resolvePageType(pageTypes, urlPath) {
  let best = null;
  let bestLength = -1;
  for (const entry of pageTypes || []) {
    if (!entry || typeof entry.pattern !== 'string') continue;
    if (!matchPath(entry.pattern, urlPath)) continue;
    if (entry.pattern.length > bestLength) {
      best = entry.type;
      bestLength = entry.pattern.length;
    }
  }
  return best || null;
}

module.exports = {
  USAGE_KEYS,
  LIMIT_KEYS,
  DEFAULT_POLICY,
  MAKO_TYPES,
  normalizePolicy,
  validatePolicy,
  validateRules,
  validatePageTypes,
  matchPath,
  effectivePolicy,
  resolveOverride,
  resolvePageType
};
