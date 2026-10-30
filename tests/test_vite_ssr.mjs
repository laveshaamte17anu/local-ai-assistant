import { createServer } from '../frontend/node_modules/vite/dist/node/index.js';

async function testViteSSR() {
  const vite = await createServer({
    root: './frontend',
    server: { middlewareMode: true },
    appType: 'custom',
  });

  try {
    console.log('Loading /src/App.jsx...');
    const mod = await vite.ssrLoadModule('/src/App.jsx');
    console.log('App exported successfully:', !!mod.default);

    console.log('Loading /src/components/GreetingSection.jsx...');
    const greetingMod = await vite.ssrLoadModule('/src/components/GreetingSection.jsx');
    console.log('GreetingSection exported successfully:', !!greetingMod.default);

    console.log('Loading /src/components/AIBuddy.jsx...');
    const buddyMod = await vite.ssrLoadModule('/src/components/AIBuddy.jsx');
    console.log('AIBuddy exported successfully:', !!buddyMod.default);

    console.log('Loading /src/components/ChatWindow.jsx...');
    const chatMod = await vite.ssrLoadModule('/src/components/ChatWindow.jsx');
    console.log('ChatWindow exported successfully:', !!chatMod.default);

    console.log('ALL MODULES LOADED WITH ZERO ERRORS!');
  } catch (err) {
    console.error('ERROR LOADING MODULES:', err);
  } finally {
    await vite.close();
  }
}

testViteSSR();
