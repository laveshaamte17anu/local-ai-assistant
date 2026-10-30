import { spawn } from 'child_process';
import http from 'http';

async function main() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const port = 9223;
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-sandbox',
    '--disable-gpu',
    'about:blank',
  ]);

  await new Promise((r) => setTimeout(r, 1500));

  http.get(`http://127.0.0.1:${port}/json`, async (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', async () => {
      try {
        const tabs = JSON.parse(data);
        const wsUrl = tabs[0]?.webSocketDebuggerUrl;
        if (!wsUrl) {
          console.log('No tab found');
          chrome.kill();
          return;
        }

        const ws = new WebSocket(wsUrl);
        let id = 1;
        const send = (method, params = {}) => {
          ws.send(JSON.stringify({ id: id++, method, params }));
        };

        ws.onopen = () => {
          send('Runtime.enable');
          send('Log.enable');
          send('Page.enable');
          send('Page.navigate', { url: 'http://localhost:5174/' });
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.method === 'Runtime.consoleAPICalled') {
            console.log('CONSOLE:', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
          }
          if (msg.method === 'Runtime.exceptionThrown') {
            console.log('EXCEPTION:', JSON.stringify(msg.params.exceptionDetails));
          }
          if (msg.result?.result?.value !== undefined) {
            console.log('EVAL RESULT:', msg.result.result.value);
          }
        };

        await new Promise((r) => setTimeout(r, 4000));
        
        // Evaluate document.getElementById('root').innerHTML
        ws.send(JSON.stringify({
          id: id++,
          method: 'Runtime.evaluate',
          params: { expression: 'document.getElementById("root")?.innerHTML?.slice(0, 500)' }
        }));

        await new Promise((r) => setTimeout(r, 1500));
        ws.close();
      } catch (e) {
        console.error(e);
      } finally {
        chrome.kill();
      }
    });
  }).on('error', (err) => {
    console.error('HTTP Error:', err.message);
    chrome.kill();
  });
}

main();
