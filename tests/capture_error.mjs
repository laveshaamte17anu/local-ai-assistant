import { spawn } from 'child_process';
import http from 'http';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9230;

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  '--no-sandbox',
  '--disable-gpu',
  'http://[::1]:5174/',
]);

async function check() {
  await new Promise((r) => setTimeout(r, 1500));
  const data = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json`, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => resolve(b));
    }).on('error', reject);
  });
  const tabs = JSON.parse(data);
  console.log('Tabs count:', tabs.length, 'types:', tabs.map(t => t.type + ': ' + t.url));
  const pageTab = tabs.find(t => t.type === 'page');
  if (!pageTab) {
    console.log('No page tab found!');
    chrome.kill();
    return;
  }
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    ws.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
  });

  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.consoleAPICalled') {
      console.log('CONSOLE:', m.params.type, JSON.stringify(m.params.args.map(a => a.value || a.description)));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      console.error('EXCEPTION:', JSON.stringify(m.params.exceptionDetails, null, 2));
    }
    if (m.id === 10) {
      console.log('ROOT HTML SNIPPET:', (m.result?.result?.value || '').slice(0, 400));
    }
    if (m.id === 11) {
      console.log('LOCATION:', m.result?.result?.value);
    }
  });

  await new Promise((r) => setTimeout(r, 3000));

  ws.send(JSON.stringify({
    id: 11,
    method: 'Runtime.evaluate',
    params: { expression: 'window.location.href' }
  }));

  ws.send(JSON.stringify({
    id: 10,
    method: 'Runtime.evaluate',
    params: { expression: 'document.getElementById("root")?.innerHTML' }
  }));

  await new Promise((r) => setTimeout(r, 1000));
  ws.close();
  chrome.kill();
}

check().catch(console.error);
