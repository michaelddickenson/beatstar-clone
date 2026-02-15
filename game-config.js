// Game Configuration - FIXED DIMENSIONS
const GAME_CONFIG = {
  LANES: 4,
  HIT_PANEL_START: 0.75,
  HIT_PANEL_HEIGHT: 0.15,
  HIT_LINE: 0.825,
  NOTE_SPEED: 0.00045,
  NOTE_WIDTH_RATIO: 0.88, // Narrower so tiles are taller than wide
  NOTE_HEIGHT: 160, // TALLER (height > width now!)
  HOLD_TRAIL_WIDTH: 8, // Thin vertical line for holds
  TIMING_WINDOWS: {
    perfect: 75,
    great: 115,
    good: 165,
    miss: 220
  },
  NOTE_TYPES: {
    TAP: 'tap',
    HOLD: 'hold',
    SWIPE_UP: 'up',
    SWIPE_DOWN: 'down',
    SWIPE_LEFT: 'left',
    SWIPE_RIGHT: 'right'
  },
  SWIPE_THRESHOLD: 35,
  FAIL_THRESHOLD: 0.5
};

const INITIAL_PLAYER = {
  id: 'player1',
  name: 'Player',
  currency: 0,
  totalStars: 0,
  unlockedSongs: ['no-me-pidas-perdon', 'levels', 'feel-u-luv-me'],
  completedChallenges: [],
  scores: {},
  wishlist: [],
  unlockedGiftBoxes: []
};

const calculateStars = (accuracy) => {
  if (accuracy >= 98) return 5;
  if (accuracy >= 95) return 4;
  if (accuracy >= 90) return 3;
  if (accuracy >= 80) return 2;
  if (accuracy >= 60) return 1;
  return 0;
};

const calculateCurrency = (stars, difficulty) => {
  const baseReward = { easy: 5, normal: 10, hard: 20 }[difficulty] || 10;
  return baseReward * stars;
};

const loadSongs = async () => {
  const songList = window.SONG_LIST || [
    'no-me-pidas-perdon',
    'levels', 
    'feel-u-luv-me',
    'bad-romance',
    'fireflies'
  ];
  
  const songs = [];
  for (const songId of songList) {
    try {
      const response = await fetch(`./songs/${songId}.json`);
      const metadata = await response.json();
      songs.push({
        ...metadata,
        audioUrl: `./songs/${songId}.mp3`
      });
    } catch (e) {
      console.warn(`Could not load ${songId}:`, e);
    }
  }
  return songs;
};
