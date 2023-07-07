
import * as fs from 'node:fs/promises';

const workerCode = await fs.readFile('dist/worker.js', {encoding: 'utf8'});
const workerEmbedded = await fs.readFile('dist/worker_code.js', {encoding: 'utf8'});

await fs.writeFile('dist/worker_code.js', 
  workerEmbedded.replace(/'--worker-code--'/, JSON.stringify(workerCode)));