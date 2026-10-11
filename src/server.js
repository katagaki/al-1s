import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import worker from './index.js';

// Local Node adapter. Cloudflare deploys index.js directly, including its 404 handler.
const port = Number(process.env.PORT ?? 3000);
createServer(async (incoming, outgoing) => {
  try {
    const request = new Request(new URL(incoming.url, 'http://localhost'), { method: incoming.method });
    const response = await worker.fetch(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body).pipe(outgoing);
    else outgoing.end();
  } catch (error) {
    console.error(error);
    outgoing.writeHead(500, { 'Content-Type': 'text/plain' });
    outgoing.end('Internal server error\n');
  }
}).listen(port, '127.0.0.1', () => console.log(`AL-1S listening on http://127.0.0.1:${port}`));
