/* eslint-disable */

/**
 * This script populates the dev database from the github SQL links found in README
 * Usage: node setup-db.js
 */

const fs = require('fs/promises');
const path = require('path');
const https = require('https');
const { Client: Pg } = require('pg'); // should come with slonik

const request = (urlOptions, data = '') =>
  new Promise((resolve, reject) => {
    const req = https.request(urlOptions, (res) => {
      const chunks = [];

      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => {
        const { statusCode, headers } = res;
        const validResponse = statusCode >= 200 && statusCode <= 299;
        const body = chunks.join('');

        if (validResponse) resolve({ statusCode, headers, body });
        else reject(new Error(`Request failed. status: ${statusCode}, body: ${body}`));
      });
    });

    req.on('error', reject);
    req.write(data, 'binary');
    req.end();
  });

const pg = new Pg({
  // should be set by devcontainer
  connectionString: process.env.PG_CONNECTION_URI,
});

const sqlLinkRegex =
  /https:\/\/github\.com\/[A-Za-z0-9\-\_\.\~\:\/\?\#\[\]\@\!\$\&\'\(\)\*\+\,\;\=]*\.sql/g;

async function run() {
  await pg.connect().catch(console.error);

  const readme = await fs.readFile(path.resolve(__dirname, 'README.md'), { encoding: 'utf-8' });
  const sqlLinks = readme.match(sqlLinkRegex);

  for (link of sqlLinks) {
    const rawLink = link.replace('github.com', 'raw.githubusercontent.com').replace('blob/', '');
    const sql = (await request(rawLink)).body;
    try {
      await pg.query(sql);
    } catch (error) {
      console.error(error);
    }
  }

  await pg.end().catch(console.err);
}

run();
