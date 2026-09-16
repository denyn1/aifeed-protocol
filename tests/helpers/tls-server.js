'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'tls');

function startFixtureServer(handler) {
  const key = fs.readFileSync(path.join(FIXTURE_DIR, 'key.pem'));
  const cert = fs.readFileSync(path.join(FIXTURE_DIR, 'cert.pem'));
  const server = https.createServer({ key, cert }, handler);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        port,
        origin: 'https://127.0.0.1:' + port,
        ca: cert,
        close: () =>
          new Promise((done) => {
            if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
            server.close(() => done());
          })
      });
    });
  });
}

function sendJson(response, body, headers = {}) {
  const buffer = Buffer.from(body, 'utf8');
  response.writeHead(200, {
    'content-type': 'application/json',
    ...headers
  });
  response.end(buffer);
  return buffer;
}

module.exports = { startFixtureServer, sendJson, FIXTURE_DIR };
