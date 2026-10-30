/**
 * Greeting System for Local AI Assistant
 * Provides dynamic time-based greetings, random friendly greetings,
 * and activity-aware welcome messages.
 */

export const TIME_GREETINGS = {
  morning: "Good morning! ☀️ Ready for a fresh start?",
  afternoon: "Hey! How's your day going?",
  evening: "Good evening! What's on your mind?",
  night: "Still awake? Let's have a little chat! 🌙",
};

export const RANDOM_GREETINGS = [
  "Hey there! 👋 What are we doing today?",
  "Welcome back! Ready to explore something new?",
  "Hey buddy! Got something interesting to discuss?",
  "I'm here! What's on your mind?",
  "Let's make today interesting! 😎",
];

export const FIRST_VISIT_GREETING =
  "Welcome! 👋 Meet your local, private AI companion. Ready to explore something new?";

export const QUICK_SUGGESTIONS = [
  { label: 'Tell me a fun fact', prompt: 'Tell me a fun fact' },
  { label: 'Tell me a joke', prompt: 'Tell me a joke' },
  { label: 'Teach me something', prompt: 'Teach me something' },
];

/**
 * Return time-of-day greeting based on local time
 * - Morning: 5:00 AM - 11:59 AM
 * - Afternoon: 12:00 PM - 4:59 PM
 * - Evening: 5:00 PM - 8:59 PM
 * - Night: 9:00 PM - 4:59 AM
 */
export function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) {
    return TIME_GREETINGS.morning;
  }
  if (hour >= 12 && hour < 17) {
    return TIME_GREETINGS.afternoon;
  }
  if (hour >= 17 && hour < 21) {
    return TIME_GREETINGS.evening;
  }
  return TIME_GREETINGS.night;
}

/**
 * Deterministic pseudo-random helper using a string seed (e.g. conversationId)
 * Ensures the greeting doesn't flicker/change on component re-renders.
 */
function hashString(str) {
  let hash = 0;
  if (!str || str.length === 0) return Math.floor(Math.random() * 10000);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a greeting based on app activity, time of day, and seed.
 *
 * @param {Object} options
 * @param {string} [options.seed] - Seed string (e.g. conversationId) to maintain stability across renders
 * @param {boolean} [options.isFirstVisit] - Whether user is visiting for the first time
 * @param {boolean} [options.hasHistory] - Whether prior conversations/history exist
 * @param {Date} [options.date] - Optional date override for testing
 * @returns {string} The greeting message
 */
export function getGreeting({
  seed = '',
  isFirstVisit = false,
  hasHistory = false,
  date = new Date(),
} = {}) {
  // First visit takes precedence on a clean browser
  if (isFirstVisit) {
    return FIRST_VISIT_GREETING;
  }

  const timeGreeting = getTimeGreeting(date);

  // Pool of friendly candidates combining time-specific and friendly variations
  const candidatePool = [
    timeGreeting,
    timeGreeting, // weight time greeting slightly higher
    ...RANDOM_GREETINGS,
  ];

  // If returning user with history, ensure "Welcome back" is in the active rotation
  if (hasHistory && !candidatePool.includes("Welcome back! Ready to explore something new?")) {
    candidatePool.push("Welcome back! Ready to explore something new?");
  }

  // Use seed if provided for render-stability, otherwise pick from pool
  const index = seed
    ? hashString(seed) % candidatePool.length
    : Math.floor(Math.random() * candidatePool.length);

  return candidatePool[index];
}

/**
 * Check and mark first-time visit in localStorage
 */
export function checkIsFirstVisit() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  const visited = localStorage.getItem('localai_has_visited');
  if (!visited) {
    localStorage.setItem('localai_has_visited', 'true');
    return true;
  }
  return false;
}

