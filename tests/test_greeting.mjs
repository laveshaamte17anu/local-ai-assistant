import assert from 'node:assert';
import {
  getTimeGreeting,
  getGreeting,
  TIME_GREETINGS,
  RANDOM_GREETINGS,
  FIRST_VISIT_GREETING,
  QUICK_SUGGESTIONS,
} from '../frontend/src/utils/greeting.js';

console.log('Running Greeting System Unit Tests...\n');

// 1. Test Morning Range (5:00 AM - 11:59 AM)
{
  const d5am = new Date(2026, 0, 1, 5, 0, 0);
  assert.strictEqual(getTimeGreeting(d5am), TIME_GREETINGS.morning);

  const d8am = new Date(2026, 0, 1, 8, 30, 0);
  assert.strictEqual(getTimeGreeting(d8am), TIME_GREETINGS.morning);

  const d1159am = new Date(2026, 0, 1, 11, 59, 59);
  assert.strictEqual(getTimeGreeting(d1159am), TIME_GREETINGS.morning);
  console.log('✓ Morning greetings (5:00 AM - 11:59 AM) passed.');
}

// 2. Test Afternoon Range (12:00 PM - 4:59 PM)
{
  const d12pm = new Date(2026, 0, 1, 12, 0, 0);
  assert.strictEqual(getTimeGreeting(d12pm), TIME_GREETINGS.afternoon);

  const d2pm = new Date(2026, 0, 1, 14, 15, 0);
  assert.strictEqual(getTimeGreeting(d2pm), TIME_GREETINGS.afternoon);

  const d459pm = new Date(2026, 0, 1, 16, 59, 59);
  assert.strictEqual(getTimeGreeting(d459pm), TIME_GREETINGS.afternoon);
  console.log('✓ Afternoon greetings (12:00 PM - 4:59 PM) passed.');
}

// 3. Test Evening Range (5:00 PM - 8:59 PM)
{
  const d5pm = new Date(2026, 0, 1, 17, 0, 0);
  assert.strictEqual(getTimeGreeting(d5pm), TIME_GREETINGS.evening);

  const d7pm = new Date(2026, 0, 1, 19, 0, 0);
  assert.strictEqual(getTimeGreeting(d7pm), TIME_GREETINGS.evening);

  const d859pm = new Date(2026, 0, 1, 20, 59, 59);
  assert.strictEqual(getTimeGreeting(d859pm), TIME_GREETINGS.evening);
  console.log('✓ Evening greetings (5:00 PM - 8:59 PM) passed.');
}

// 4. Test Night Range (9:00 PM - 4:59 AM)
{
  const d9pm = new Date(2026, 0, 1, 21, 0, 0);
  assert.strictEqual(getTimeGreeting(d9pm), TIME_GREETINGS.night);

  const dMidnight = new Date(2026, 0, 1, 0, 0, 0);
  assert.strictEqual(getTimeGreeting(dMidnight), TIME_GREETINGS.night);

  const d3am = new Date(2026, 0, 1, 3, 30, 0);
  assert.strictEqual(getTimeGreeting(d3am), TIME_GREETINGS.night);

  const d459am = new Date(2026, 0, 1, 4, 59, 59);
  assert.strictEqual(getTimeGreeting(d459am), TIME_GREETINGS.night);
  console.log('✓ Night greetings (9:00 PM - 4:59 AM) passed.');
}

// 5. Test First Visit Behavior
{
  const firstVisitResult = getGreeting({
    seed: 'initial-conv-1',
    isFirstVisit: true,
    hasHistory: false,
  });
  assert.strictEqual(firstVisitResult, FIRST_VISIT_GREETING);
  console.log('✓ First visit greeting passed.');
}

// 6. Test Render Stability (Seed Consistency)
{
  const seed = 'conv_fixed_session_123';
  const greeting1 = getGreeting({ seed, isFirstVisit: false });
  const greeting2 = getGreeting({ seed, isFirstVisit: false });
  const greeting3 = getGreeting({ seed, isFirstVisit: false });
  assert.strictEqual(greeting1, greeting2);
  assert.strictEqual(greeting2, greeting3);
  console.log('✓ Render stability check (no flickering across re-renders) passed.');
}

// 7. Test New Conversation Behavior (Different Seeds generate fresh greetings)
{
  const greetings = new Set();
  for (let i = 0; i < 20; i++) {
    const res = getGreeting({
      seed: `conv_new_${i}_${Date.now() + i * 100}`,
      isFirstVisit: false,
      hasHistory: true,
    });
    greetings.add(res);
  }
  // Across 20 distinct seeds, multiple unique friendly greetings should be picked
  assert.ok(greetings.size > 1, 'Should produce variations across conversations');
  console.log(`✓ New conversation variation check passed (${greetings.size} distinct variants).`);
}

// 8. Test Quick Suggestions Configuration
{
  assert.strictEqual(QUICK_SUGGESTIONS.length, 3);
  assert.strictEqual(QUICK_SUGGESTIONS[0].prompt, 'Tell me a fun fact');
  assert.strictEqual(QUICK_SUGGESTIONS[1].prompt, 'Tell me a joke');
  assert.strictEqual(QUICK_SUGGESTIONS[2].prompt, 'Teach me something');
  console.log('✓ Quick suggestions configuration verified.');
}

console.log('\nAll Greeting System tests passed successfully! ✨');

