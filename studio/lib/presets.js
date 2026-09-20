'use strict';

const { PROFILES, USAGE_KEYS } = require('../../lib/scaffold');
const { DEFAULT_POLICY, normalizePolicy } = require('./policy');

const PRESET_NAMES = Object.keys(PROFILES);
const TYPE_PRESETS = {
  news: 'news',
  ecommerce: 'ecommerce',
  marketplace: 'marketplace',
  government: 'government',
  blog: 'blog',
  media: 'blog',
  docs: 'blog',
  education: 'blog',
  saas: 'blog',
  portfolio: 'blog',
  community: 'blog',
  nonprofit: 'blog',
  personal: 'blog',
  other: 'blog'
};

function presetForType(type) {
  return TYPE_PRESETS[String(type || '').toLowerCase()] || 'blog';
}

function presetPolicy(name) {
  const preset = PROFILES[name] || PROFILES.blog;
  const usage = {};
  for (const key of USAGE_KEYS) {
    usage[key] = preset.usage.includes(key) ? 'allow' : 'deny';
  }
  return normalizePolicy({
    ...DEFAULT_POLICY,
    usage,
    attribution: preset.attribution,
    rules: []
  });
}

function listPresets() {
  return PRESET_NAMES.map((name) => ({ name, policy: presetPolicy(name) }));
}

module.exports = { PRESET_NAMES, TYPE_PRESETS, presetForType, presetPolicy, listPresets };
