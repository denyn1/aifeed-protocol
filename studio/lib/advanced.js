'use strict';

const siteLib = require('../../lib/site');
const schemaLib = require('../../lib/schema');
const schema = require('../../schema/ai-json.v0.2.json');
const { importOpenApi } = require('../../lib/openapi');

const ADVANCED_KEYS = ['types', 'capabilities', 'actions'];

function validateAdvanced(advanced, project, publicKeyValue) {
  if (advanced === undefined || advanced === null) return [];
  if (typeof advanced !== 'object' || Array.isArray(advanced)) return ['advanced must be an object'];
  const errors = [];
  for (const key of Object.keys(advanced)) {
    if (!ADVANCED_KEYS.includes(key)) errors.push('unknown advanced field: ' + key);
  }
  const draft = siteLib.buildManifest({
    domain: project.domain,
    name: project.name,
    type: project.type,
    locale: project.locale,
    contact: project.contact,
    publicKey: publicKeyValue,
    keyId: project.key_id,
    profile: project.profile,
    languages: [String(project.locale).split('-')[0].toLowerCase()],
    llms: true
  });
  for (const key of ADVANCED_KEYS) {
    if (advanced[key] !== undefined) draft[key] = advanced[key];
  }
  for (const issue of schemaLib.validate(draft, schema)) {
    const root = String(issue.path).split(/[.[]/)[1];
    if (ADVANCED_KEYS.includes(root)) errors.push(issue.path + ': ' + issue.message);
  }
  return errors;
}

module.exports = { ADVANCED_KEYS, validateAdvanced, importOpenApi };
