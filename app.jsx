import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Settings, Plus, Gift, Star, Lock, Check, TrendingUp, Music, Award, Box, List } from 'lucide-react';

// ==================== GAME CONSTANTS ====================
const LANES = 4;
const HIT_ZONE_POSITION = 0.75; // 75% down the screen
const NOTE_SPEED = 0.003; // notes per millisecond
const TIMING_WINDOWS = {
  perfect: 50,
  great: 100,
  good: 150,
  miss: 200
};

const NOTE_TYPES = {
  TAP: 'tap',
  HOLD: 'hold',
  SWIPE_UP: 'swipe-up',
  SWIPE_DOWN: 'swipe-down',
  SWIPE_LEFT: 'swipe-left',
  SWIPE_RIGHT: 'swipe-right'
};

// ==================== INITIAL DATA ====================
const INITIAL_PLAYER = {
  id: 'player1',
  name: 'Player',
  currency: 100,
  totalStars: 0,
  unlockedSongs: ['song-1', 'song-2', 'song-3'],
  completedChallenges: [],
  scores: {}, // songId-difficulty: { score, stars, accuracy }
  wishlist: [],
  unlockedGiftBoxes: []
};

const INITIAL_SONGS = [
  {
    id: 'song-1',
    title: 'Starter Beat',
    artist: 'Tutorial',
    genre: 'Electronic',
    unlockTier: 0,
    bpm: 128,
    duration: 180,
    difficulty: { easy: 1, normal: 3, hard: 5, expert: 7 },
    beatmap: null, // Will be auto-generated
    coverArt: null
  },
  {
    id: 'song-2',
    title: 'Rhythm Flow',
    artist: 'Beginner',
    genre: 'Pop',
    unlockTier: 0,
    bpm: 120,
    duration: 200,
    difficulty: { easy: 2, normal: 4, hard: 6, expert: 8 },
    beatmap: null,
    coverArt: null
  },
  {
    id: 'song-3',
    title: 'Beat Drop',
    artist: 'Starter',
    genre: 'Electronic',
    unlockTier: 0,
    bpm: 140,
    duration: 190,
    difficulty: { easy: 1, normal: 3, hard: 5, expert: 8 },
    beatmap: null,
    coverArt: null
  },
  {
    id: 'song-4',
    title: 'Locked Song 1',
    artist: 'Mystery',
    genre: 'Rock',
    unlockTier: 1,
    requiredStars: 15,
    bpm: 135,
    duration: 210,
    difficulty: { easy: 3, normal: 5, hard: 7, expert: 9 },
    beatmap: null,
    coverArt: null
  },
  {
    id: 'song-5',
    title: 'Locked Song 2',
    artist: 'Unknown',
    genre: 'EDM',
    unlockTier: 1,
    requiredStars: 15,
    bpm: 145,
    duration: 195,
    difficulty: { easy: 2, normal: 4, hard: 6, expert: 9 },
    beatmap: null,
    coverArt: null
  },
  {
    id: 'song-6',
    title: 'Locked Song 3',
    artist: 'Secret',
    genre: 'Hip Hop',
    unlockTier: 1,
    requiredStars: 15,
    bpm: 95,
    duration: 220,
    difficulty: { easy: 3, normal: 5, hard: 7, expert: 8 },
    beatmap: null,
    coverArt: null
  }
];

const GIFT_BOXES = [
  {
    id: 'rock-box',
    name: 'Rock Collection',
    genre: 'Rock',
    price: 150,
    songs: ['rock-1', 'rock-2', 'rock-3']
  },
  {
    id: 'edm-box',
    name: 'EDM Pack',
    genre: 'EDM',
    price: 200,
    songs: ['edm-1', 'edm-2', 'edm-3', 'edm-4']
  },
  {
    id: 'pop-box',
    name: 'Pop Hits',
    genre: 'Pop',
    price: 175,
    songs: ['pop-1', 'pop-2', 'pop-3']
  }
];

const CHALLENGES = [
  {
    id: 'challenge-1',
    name: 'First Steps',
    description: 'Complete 5 songs',
    type: 'play-count',
    requirement: 5,
    reward: 50
  },
  {
    id: 'challenge-2',
    name: 'Perfect Player',
    description: 'Get 5 stars on 3 songs',
    type: 'five-stars',
    requirement: 3,
    reward: 100
  },
  {
    id: 'challenge-3',
    name: 'Hard Mode',
    description: 'Complete 5 Hard difficulty songs',
    type: 'hard-completion',
    requirement: 5,
    reward: 150
  }
];

// ==================== UTILITY FUNCTIONS ====================
const generateBeatmap = (bpm, duration, difficulty) => {
  const notes = [];
  const beatInterval = (60 / bpm) * 1000; // ms per beat
  const noteDensity = {
    easy: 0.5,
    normal: 0.75,
    hard: 1.0,
    expert: 1.5
  }[difficulty] || 1.0;

  let time = 2000; // Start after 2 seconds
  const endTime = duration * 1000 - 2000;

  while (time < endTime) {
    const lane = Math.floor(Math.random() * LANES);
    const noteTypeRoll = Math.random();
    
    let noteType = NOTE_TYPES.TAP;
    if (difficulty === 'hard' || difficulty === 'expert') {
      if (noteTypeRoll < 0.15) noteType = NOTE_TYPES.HOLD;
      else if (noteTypeRoll < 0.25) noteType = NOTE_TYPES.SWIPE_UP;
      else if (noteTypeRoll < 0.35) noteType = NOTE_TYPES.SWIPE_DOWN;
      else if (noteTypeRoll < 0.40) noteType = NOTE_TYPES.SWIPE_LEFT;
      else if (noteTypeRoll < 0.45) noteType = NOTE_TYPES.SWIPE_RIGHT;
    } else if (difficulty === 'normal') {
      if (noteTypeRoll < 0.1) noteType = NOTE_TYPES.HOLD;
      else if (noteTypeRoll < 0.15) noteType = NOTE_TYPES.SWIPE_UP;
    }

    notes.push({
      id: `note-${time}-${lane}`,
      lane,
      time,
      type: noteType,
      duration: noteType === NOTE_TYPES.HOLD ? beatInterval * 2 : 0
    });

    time += beatInterval / noteDensity;
  }

  return notes;
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
  const baseReward = { easy: 10, normal: 20, hard: 30, expert: 50 }[difficulty] || 10;
  return baseReward * stars;
};

// ==================== MAIN COMPONENT ====================
export default function BeatstarClone() {
  const [currentScreen, setCurrentScreen] = useState('home'); // home, game, admin, shop, challenges
  const [player, setPlayer] = useState(() => {
    const saved = localStorage.getItem('beatstar-player');
    return saved ? JSON.parse(saved) : INITIAL_PLAYER;
  });
  const [songs, setSongs] = useState(() => {
    const saved = localStorage.getItem('beatstar-songs');
    return saved ? JSON.parse(saved) : INITIAL_SONGS;
  });
  const [selectedSong, setSelectedSong] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState('normal');
  const [showUnlockChoice, setShowUnlockChoice] = useState(false);
  const [unlockOptions, setUnlockOptions] = useState([]);

  // Save to localStorage whenever player or songs change
  useEffect(() => {
    localStorage.setItem('beatstar-player', JSON.stringify(player));
  }, [player]);

  useEffect(() => {
    localStorage.setItem('beatstar-songs', JSON.stringify(songs));
  }, [songs]);

  const isSongUnlocked = (song) => {
    return player.unlockedSongs.includes(song.id);
  };

  const canUnlockSong = (song) => {
    if (song.requiredStars && player.totalStars < song.requiredStars) return false;
    return true;
  };

  const unlockSong = (songId) => {
    setPlayer(prev => ({
      ...prev,
      unlockedSongs: [...prev.unlockedSongs, songId]
    }));
  };

  const handleUnlockWithChoice = () => {
    const lockedSongs = songs.filter(s => !isSongUnlocked(s) && canUnlockSong(s));
    if (lockedSongs.length === 0) return;

    // Prioritize wishlist songs
    const wishlistSongs = lockedSongs.filter(s => player.wishlist.includes(s.id));
    const otherSongs = lockedSongs.filter(s => !player.wishlist.includes(s.id));

    const options = [];
    // Add up to 2 wishlist songs
    options.push(...wishlistSongs.slice(0, 2));
    // Fill remaining with random songs
    const remaining = 3 - options.length;
    const shuffled = [...otherSongs].sort(() => Math.random() - 0.5);
    options.push(...shuffled.slice(0, remaining));

    setUnlockOptions(options);
    setShowUnlockChoice(true);
  };

  const confirmUnlock = (songId) => {
    unlockSong(songId);
    setShowUnlockChoice(false);
    setUnlockOptions([]);
  };

  const purchaseGiftBox = (box) => {
    if (player.currency < box.price) return;

    setPlayer(prev => ({
      ...prev,
      currency: prev.currency - box.price,
      unlockedSongs: [...new Set([...prev.unlockedSongs, ...box.songs])],
      unlockedGiftBoxes: [...prev.unlockedGiftBoxes, box.id]
    }));
  };

  const toggleWishlist = (songId) => {
    setPlayer(prev => ({
      ...prev,
      wishlist: prev.wishlist.includes(songId)
        ? prev.wishlist.filter(id => id !== songId)
        : [...prev.wishlist, songId]
    }));
  };

  const startGame = (song, difficulty) => {
    setSelectedSong(song);
    setSelectedDifficulty(difficulty);
    setCurrentScreen('game');
  };

  const endGame = (score, accuracy, perfect, great, good, miss) => {
    const stars = calculateStars(accuracy);
    const currencyEarned = calculateCurrency(stars, selectedDifficulty);

    const scoreKey = `${selectedSong.id}-${selectedDifficulty}`;
    const previousBest = player.scores[scoreKey];
    const isNewBest = !previousBest || score > previousBest.score;

    setPlayer(prev => {
      const newScores = { ...prev.scores };
      if (isNewBest) {
        newScores[scoreKey] = { score, stars, accuracy, perfect, great, good, miss };
      }

      const newTotalStars = Object.values(newScores).reduce((sum, s) => sum + s.stars, 0);

      return {
        ...prev,
        scores: newScores,
        totalStars: newTotalStars,
        currency: prev.currency + currencyEarned
      };
    });

    setCurrentScreen('home');
  };

  // ==================== RENDER FUNCTIONS ====================
  const renderHome = () => (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-blue-900 text-white">
      {/* Header */}
      <div className="bg-black/40 backdrop-blur-sm border-b border-purple-500/30 p-4">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              BEATSTAR
            </h1>
            <p className="text-sm text-purple-300">{player.name}</p>
          </div>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-full border border-yellow-400/30">
              <Award className="w-5 h-5 text-yellow-400" />
              <span className="font-bold text-yellow-300">{player.currency}</span>
            </div>
            <div className="flex items-center gap-2 bg-purple-500/20 px-4 py-2 rounded-full border border-purple-400/30">
              <Star className="w-5 h-5 text-purple-400" />
              <span className="font-bold text-purple-300">{player.totalStars}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-black/30 border-b border-purple-500/20 p-3">
        <div className="flex gap-3 max-w-6xl mx-auto overflow-x-auto">
          {['Songs', 'Shop', 'Challenges', 'Admin'].map(tab => (
            <button
              key={tab}
              onClick={() => setCurrentScreen(tab.toLowerCase())}
              className={`px-6 py-2 rounded-lg font-bold whitespace-nowrap transition-all ${
                currentScreen === tab.toLowerCase()
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/50'
                  : 'bg-white/5 text-purple-300 hover:bg-white/10'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Song List */}
      {currentScreen === 'home' && (
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-purple-300">Your Songs</h2>
            <button
              onClick={handleUnlockWithChoice}
              className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 rounded-lg font-bold hover:shadow-lg hover:shadow-green-500/50 transition-all"
            >
              <Plus className="w-5 h-5" />
              Unlock New Song
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {songs.map(song => {
              const unlocked = isSongUnlocked(song);
              const canUnlock = canUnlockSong(song);
              
              return (
                <div
                  key={song.id}
                  className={`relative bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-xl p-5 border-2 transition-all ${
                    unlocked
                      ? 'border-purple-500/50 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-500/30 cursor-pointer'
                      : 'border-gray-700/50 opacity-60'
                  }`}
                  onClick={() => unlocked && setSelectedSong(song)}
                >
                  {!unlocked && (
                    <div className="absolute top-3 right-3 bg-red-500/80 p-2 rounded-full">
                      <Lock className="w-4 h-4" />
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                      <Music className="w-8 h-8" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{unlocked ? song.title : '???'}</h3>
                      <p className="text-sm text-purple-300">{unlocked ? song.artist : 'Locked'}</p>
                    </div>
                  </div>

                  {unlocked && (
                    <>
                      <div className="flex gap-2 mb-3">
                        <span className="text-xs px-2 py-1 bg-purple-500/30 rounded">{song.genre}</span>
                        <span className="text-xs px-2 py-1 bg-blue-500/30 rounded">{song.bpm} BPM</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {['easy', 'normal', 'hard', 'expert'].map(diff => {
                          const scoreKey = `${song.id}-${diff}`;
                          const score = player.scores[scoreKey];
                          
                          return (
                            <button
                              key={diff}
                              onClick={(e) => {
                                e.stopPropagation();
                                startGame(song, diff);
                              }}
                              className="bg-black/40 p-2 rounded-lg hover:bg-black/60 transition-all text-left"
                            >
                              <div className="text-xs font-bold uppercase text-purple-300">{diff}</div>
                              <div className="text-xs text-gray-400">Lvl {song.difficulty[diff]}</div>
                              {score && (
                                <div className="flex items-center gap-1 mt-1">
                                  {[...Array(score.stars)].map((_, i) => (
                                    <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                  ))}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {!unlocked && song.requiredStars && (
                    <div className="text-sm text-center mt-3 text-gray-400">
                      Requires {song.requiredStars} ⭐ ({canUnlock ? 'Ready!' : `Need ${song.requiredStars - player.totalStars} more`})
                    </div>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWishlist(song.id);
                    }}
                    className={`absolute bottom-3 right-3 p-2 rounded-full transition-all ${
                      player.wishlist.includes(song.id)
                        ? 'bg-pink-500 text-white'
                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }`}
                  >
                    <Star className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unlock Choice Modal */}
      {showUnlockChoice && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-purple-900 to-blue-900 rounded-2xl p-8 max-w-4xl w-full border-2 border-purple-500">
            <h2 className="text-3xl font-black mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              Choose Your Next Song
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {unlockOptions.map(song => (
                <div
                  key={song.id}
                  onClick={() => confirmUnlock(song.id)}
                  className="bg-black/40 rounded-xl p-5 border-2 border-purple-500/50 hover:border-pink-500 cursor-pointer transition-all hover:shadow-xl hover:shadow-pink-500/30"
                >
                  <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center mx-auto mb-3">
                    <Music className="w-10 h-10" />
                  </div>
                  <h3 className="font-bold text-center mb-1">{song.title}</h3>
                  <p className="text-sm text-purple-300 text-center mb-2">{song.artist}</p>
                  <div className="flex justify-center gap-2">
                    <span className="text-xs px-2 py-1 bg-purple-500/30 rounded">{song.genre}</span>
                  </div>
                  {player.wishlist.includes(song.id) && (
                    <div className="text-center mt-2 text-pink-400 text-xs font-bold">⭐ WISHLIST</div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowUnlockChoice(false)}
              className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-bold transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderShop = () => (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-blue-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => setCurrentScreen('home')}
          className="mb-6 px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition-all"
        >
          ← Back
        </button>

        <h2 className="text-3xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
          Gift Box Shop
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {GIFT_BOXES.map(box => {
            const purchased = player.unlockedGiftBoxes.includes(box.id);
            const canAfford = player.currency >= box.price;

            return (
              <div
                key={box.id}
                className={`bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-xl p-6 border-2 transition-all ${
                  purchased
                    ? 'border-green-500/50 opacity-60'
                    : canAfford
                    ? 'border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/30'
                    : 'border-gray-700/50 opacity-40'
                }`}
              >
                <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
                  <Gift className="w-12 h-12" />
                </div>

                <h3 className="font-bold text-xl text-center mb-2">{box.name}</h3>
                <p className="text-sm text-purple-300 text-center mb-4">{box.songs.length} Songs</p>

                {purchased ? (
                  <div className="bg-green-500/20 py-3 rounded-lg text-center font-bold text-green-400 flex items-center justify-center gap-2">
                    <Check className="w-5 h-5" />
                    Owned
                  </div>
                ) : (
                  <button
                    onClick={() => purchaseGiftBox(box)}
                    disabled={!canAfford}
                    className={`w-full py-3 rounded-lg font-bold transition-all ${
                      canAfford
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-lg hover:shadow-purple-500/50'
                        : 'bg-gray-700 cursor-not-allowed'
                    }`}
                  >
                    {canAfford ? `Buy for ${box.price} 💰` : `Need ${box.price - player.currency} more`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderChallenges = () => (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-blue-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => setCurrentScreen('home')}
          className="mb-6 px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition-all"
        >
          ← Back
        </button>

        <h2 className="text-3xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
          Challenges
        </h2>

        <div className="space-y-4">
          {CHALLENGES.map(challenge => {
            const completed = player.completedChallenges.includes(challenge.id);

            return (
              <div
                key={challenge.id}
                className={`bg-gradient-to-r rounded-xl p-6 border-2 ${
                  completed
                    ? 'from-green-900/50 to-emerald-900/50 border-green-500/50'
                    : 'from-purple-900/50 to-blue-900/50 border-purple-500/50'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-xl mb-1">{challenge.name}</h3>
                    <p className="text-sm text-purple-300">{challenge.description}</p>
                  </div>
                  {completed && <Check className="w-8 h-8 text-green-400" />}
                </div>

                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-400">Reward: {challenge.reward} 💰</div>
                  {!completed && <div className="text-sm text-purple-400">In Progress...</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderAdmin = () => (
    <AdminPanel
      songs={songs}
      setSongs={setSongs}
      onBack={() => setCurrentScreen('home')}
    />
  );

  const renderGame = () => (
    <GameScreen
      song={selectedSong}
      difficulty={selectedDifficulty}
      onEnd={endGame}
      onBack={() => setCurrentScreen('home')}
    />
  );

  // Main render
  if (currentScreen === 'game' && selectedSong) return renderGame();
  if (currentScreen === 'admin') return renderAdmin();
  if (currentScreen === 'shop') return renderShop();
  if (currentScreen === 'challenges') return renderChallenges();
  return renderHome();
}

// ==================== GAME SCREEN COMPONENT ====================
function GameScreen({ song, difficulty, onEnd, onBack }) {
  const [gameState, setGameState] = useState('ready'); // ready, playing, finished
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [judgments, setJudgments] = useState({ perfect: 0, great: 0, good: 0, miss: 0 });
  const [notes, setNotes] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [beatmap, setBeatmap] = useState(null);
  const [activeHolds, setActiveHolds] = useState([]);
  const [touchStart, setTouchStart] = useState({});
  const audioRef = useRef(null);
  const gameLoopRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    // Generate beatmap if not exists
    const map = song.beatmap || generateBeatmap(song.bpm, song.duration, difficulty);
    setBeatmap(map);
    setNotes(map.map(n => ({ ...n, hit: false, missed: false })));
  }, [song, difficulty]);

  const startGame = () => {
    setGameState('playing');
    startTimeRef.current = Date.now();
    
    gameLoopRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setCurrentTime(elapsed);

      // Check for missed notes
      setNotes(prev => prev.map(note => {
        if (!note.hit && !note.missed && elapsed > note.time + TIMING_WINDOWS.miss) {
          setCombo(0);
          setJudgments(j => ({ ...j, miss: j.miss + 1 }));
          return { ...note, missed: true };
        }
        return note;
      }));

      // End game when song finishes
      if (elapsed > song.duration * 1000) {
        endGame();
      }
    }, 16); // ~60fps
  };

  const endGame = () => {
    clearInterval(gameLoopRef.current);
    setGameState('finished');

    const totalNotes = beatmap.length;
    const hitNotes = judgments.perfect + judgments.great + judgments.good;
    const accuracy = totalNotes > 0 ? (hitNotes / totalNotes) * 100 : 0;

    setTimeout(() => {
      onEnd(score, accuracy, judgments.perfect, judgments.great, judgments.good, judgments.miss);
    }, 2000);
  };

  const handleTouchStart = (e, lane) => {
    e.preventDefault();
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY, lane, time: Date.now() });
    checkHit(lane, null);
  };

  const handleTouchEnd = (e, lane) => {
    e.preventDefault();
    if (!touchStart.lane) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 50) {
      // Detect swipe direction
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      let swipeType = null;

      if (angle > -45 && angle < 45) swipeType = NOTE_TYPES.SWIPE_RIGHT;
      else if (angle > 45 && angle < 135) swipeType = NOTE_TYPES.SWIPE_DOWN;
      else if (angle < -45 && angle > -135) swipeType = NOTE_TYPES.SWIPE_UP;
      else swipeType = NOTE_TYPES.SWIPE_LEFT;

      checkHit(lane, swipeType);
    }

    setTouchStart({});
  };

  const checkHit = (lane, swipeType) => {
    const hitTime = currentTime;
    let bestNote = null;
    let bestTiming = Infinity;

    notes.forEach(note => {
      if (note.lane === lane && !note.hit && !note.missed) {
        const timing = Math.abs(note.time - hitTime);
        if (timing < TIMING_WINDOWS.miss && timing < bestTiming) {
          // Check if note type matches
          if (swipeType && note.type !== swipeType && note.type !== NOTE_TYPES.TAP) {
            return; // Wrong swipe direction
          }
          if (!swipeType && note.type !== NOTE_TYPES.TAP && note.type !== NOTE_TYPES.HOLD) {
            return; // Need to swipe
          }

          bestNote = note;
          bestTiming = timing;
        }
      }
    });

    if (bestNote) {
      let judgment = 'miss';
      let points = 0;

      if (bestTiming < TIMING_WINDOWS.perfect) {
        judgment = 'perfect';
        points = 100;
      } else if (bestTiming < TIMING_WINDOWS.great) {
        judgment = 'great';
        points = 75;
      } else if (bestTiming < TIMING_WINDOWS.good) {
        judgment = 'good';
        points = 50;
      }

      if (judgment !== 'miss') {
        setNotes(prev => prev.map(n => n.id === bestNote.id ? { ...n, hit: true } : n));
        setScore(s => s + points * (combo + 1));
        setCombo(c => c + 1);
        setJudgments(j => ({ ...j, [judgment]: j[judgment] + 1 }));

        if (bestNote.type === NOTE_TYPES.HOLD) {
          setActiveHolds(prev => [...prev, bestNote.id]);
        }
      } else {
        setCombo(0);
      }
    }
  };

  if (gameState === 'ready') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-4xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            {song.title}
          </h1>
          <p className="text-xl text-purple-300 mb-2">{song.artist}</p>
          <p className="text-lg text-gray-400 mb-8">{difficulty.toUpperCase()} - Level {song.difficulty[difficulty]}</p>
          <button
            onClick={startGame}
            className="bg-gradient-to-r from-purple-500 to-pink-500 px-12 py-4 rounded-full text-2xl font-black hover:shadow-2xl hover:shadow-purple-500/50 transition-all"
          >
            START
          </button>
          <button
            onClick={onBack}
            className="block mx-auto mt-4 text-gray-400 hover:text-white transition-all"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    const totalNotes = beatmap.length;
    const hitNotes = judgments.perfect + judgments.great + judgments.good;
    const accuracy = totalNotes > 0 ? ((hitNotes / totalNotes) * 100).toFixed(1) : 0;
    const stars = calculateStars(accuracy);

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-blue-900 flex items-center justify-center text-white">
        <div className="text-center max-w-md">
          <h1 className="text-5xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            COMPLETE!
          </h1>
          
          <div className="flex justify-center gap-2 mb-6">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-12 h-12 ${i < stars ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'}`}
              />
            ))}
          </div>

          <div className="bg-black/40 rounded-2xl p-6 mb-6 space-y-3">
            <div className="text-4xl font-black text-purple-400">{score.toLocaleString()}</div>
            <div className="text-xl text-gray-300">Accuracy: {accuracy}%</div>
            <div className="grid grid-cols-4 gap-2 text-sm">
              <div>
                <div className="text-cyan-400 font-bold">{judgments.perfect}</div>
                <div className="text-gray-400">Perfect</div>
              </div>
              <div>
                <div className="text-green-400 font-bold">{judgments.great}</div>
                <div className="text-gray-400">Great</div>
              </div>
              <div>
                <div className="text-yellow-400 font-bold">{judgments.good}</div>
                <div className="text-gray-400">Good</div>
              </div>
              <div>
                <div className="text-red-400 font-bold">{judgments.miss}</div>
                <div className="text-gray-400">Miss</div>
              </div>
            </div>
          </div>

          <div className="text-gray-400 text-sm">Returning to menu...</div>
        </div>
      </div>
    );
  }

  // Playing state - render game field
  const visibleNotes = notes.filter(note => {
    const position = (currentTime - note.time) * NOTE_SPEED + HIT_ZONE_POSITION;
    return position >= -0.1 && position <= 1.1 && !note.hit && !note.missed;
  });

  return (
    <div className="relative min-h-screen bg-black overflow-hidden touch-none select-none">
      {/* Score Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex justify-between items-center text-white">
          <div className="text-3xl font-black text-purple-400">{score.toLocaleString()}</div>
          <div className="text-xl font-bold">Combo: <span className="text-yellow-400">{combo}</span></div>
          <button onClick={onBack} className="text-gray-400 hover:text-white">Exit</button>
        </div>
      </div>

      {/* Game Field */}
      <div className="absolute inset-0 flex" style={{ paddingTop: '10%', paddingBottom: '10%' }}>
        {[...Array(LANES)].map((_, lane) => (
          <div
            key={lane}
            className="flex-1 relative border-r border-purple-500/20"
            onTouchStart={(e) => handleTouchStart(e, lane)}
            onTouchEnd={(e) => handleTouchEnd(e, lane)}
          >
            {/* Lane background */}
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 to-blue-900/10" />

            {/* Hit zone indicator */}
            <div
              className="absolute left-0 right-0 h-2 bg-gradient-to-r from-purple-500 to-pink-500 opacity-80"
              style={{ top: `${HIT_ZONE_POSITION * 100}%` }}
            />

            {/* Notes */}
            {visibleNotes
              .filter(note => note.lane === lane)
              .map(note => {
                const position = ((currentTime - note.time) * NOTE_SPEED + HIT_ZONE_POSITION) * 100;
                
                return (
                  <div
                    key={note.id}
                    className="absolute left-0 right-0 flex items-center justify-center transition-all"
                    style={{ top: `${position}%`, transform: 'translateY(-50%)' }}
                  >
                    {note.type === NOTE_TYPES.TAP && (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/50 border-4 border-white/30" />
                    )}
                    {note.type === NOTE_TYPES.HOLD && (
                      <div className="w-16 h-32 rounded-2xl bg-gradient-to-b from-yellow-500 to-orange-500 shadow-lg shadow-yellow-500/50 border-4 border-white/30" />
                    )}
                    {note.type === NOTE_TYPES.SWIPE_UP && (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/50 border-4 border-white/30 flex items-center justify-center text-3xl">
                        ↑
                      </div>
                    )}
                    {note.type === NOTE_TYPES.SWIPE_DOWN && (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/50 border-4 border-white/30 flex items-center justify-center text-3xl">
                        ↓
                      </div>
                    )}
                    {note.type === NOTE_TYPES.SWIPE_LEFT && (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-pink-500 shadow-lg shadow-red-500/50 border-4 border-white/30 flex items-center justify-center text-3xl">
                        ←
                      </div>
                    )}
                    {note.type === NOTE_TYPES.SWIPE_RIGHT && (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 shadow-lg shadow-purple-500/50 border-4 border-white/30 flex items-center justify-center text-3xl">
                        →
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== ADMIN PANEL COMPONENT ====================
function AdminPanel({ songs, setSongs, onBack }) {
  const [newSong, setNewSong] = useState({
    title: '',
    artist: '',
    genre: '',
    bpm: 120,
    duration: 180,
    unlockTier: 0,
    requiredStars: 0
  });
  const [audioFile, setAudioFile] = useState(null);

  const handleAddSong = () => {
    if (!newSong.title || !newSong.artist) {
      alert('Please fill in title and artist');
      return;
    }

    const song = {
      id: `song-${Date.now()}`,
      ...newSong,
      difficulty: {
        easy: Math.floor(Math.random() * 3) + 1,
        normal: Math.floor(Math.random() * 3) + 3,
        hard: Math.floor(Math.random() * 3) + 5,
        expert: Math.floor(Math.random() * 3) + 7
      },
      beatmap: null,
      coverArt: null
    };

    setSongs(prev => [...prev, song]);
    
    setNewSong({
      title: '',
      artist: '',
      genre: '',
      bpm: 120,
      duration: 180,
      unlockTier: 0,
      requiredStars: 0
    });
    setAudioFile(null);

    alert('Song added successfully! Beatmap will be auto-generated on first play.');
  };

  const handleDeleteSong = (songId) => {
    if (confirm('Are you sure you want to delete this song?')) {
      setSongs(prev => prev.filter(s => s.id !== songId));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-blue-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={onBack}
          className="mb-6 px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition-all"
        >
          ← Back to Game
        </button>

        <h1 className="text-4xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
          Admin Panel
        </h1>

        {/* Add New Song */}
        <div className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-xl p-6 border-2 border-purple-500/50 mb-8">
          <h2 className="text-2xl font-bold mb-4">Add New Song</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              placeholder="Song Title"
              value={newSong.title}
              onChange={(e) => setNewSong({ ...newSong, title: e.target.value })}
              className="bg-black/40 border border-purple-500/30 rounded-lg px-4 py-2 text-white placeholder-gray-500"
            />
            <input
              type="text"
              placeholder="Artist"
              value={newSong.artist}
              onChange={(e) => setNewSong({ ...newSong, artist: e.target.value })}
              className="bg-black/40 border border-purple-500/30 rounded-lg px-4 py-2 text-white placeholder-gray-500"
            />
            <input
              type="text"
              placeholder="Genre"
              value={newSong.genre}
              onChange={(e) => setNewSong({ ...newSong, genre: e.target.value })}
              className="bg-black/40 border border-purple-500/30 rounded-lg px-4 py-2 text-white placeholder-gray-500"
            />
            <input
              type="number"
              placeholder="BPM"
              value={newSong.bpm}
              onChange={(e) => setNewSong({ ...newSong, bpm: parseInt(e.target.value) })}
              className="bg-black/40 border border-purple-500/30 rounded-lg px-4 py-2 text-white placeholder-gray-500"
            />
            <input
              type="number"
              placeholder="Duration (seconds)"
              value={newSong.duration}
              onChange={(e) => setNewSong({ ...newSong, duration: parseInt(e.target.value) })}
              className="bg-black/40 border border-purple-500/30 rounded-lg px-4 py-2 text-white placeholder-gray-500"
            />
            <input
              type="number"
              placeholder="Unlock Tier (0 = starter)"
              value={newSong.unlockTier}
              onChange={(e) => setNewSong({ ...newSong, unlockTier: parseInt(e.target.value) })}
              className="bg-black/40 border border-purple-500/30 rounded-lg px-4 py-2 text-white placeholder-gray-500"
            />
            <input
              type="number"
              placeholder="Required Stars (0 = none)"
              value={newSong.requiredStars}
              onChange={(e) => setNewSong({ ...newSong, requiredStars: parseInt(e.target.value) })}
              className="bg-black/40 border border-purple-500/30 rounded-lg px-4 py-2 text-white placeholder-gray-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Audio File (Optional - for future integration)</label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setAudioFile(e.target.files[0])}
              className="bg-black/40 border border-purple-500/30 rounded-lg px-4 py-2 text-white w-full"
            />
          </div>

          <button
            onClick={handleAddSong}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 py-3 rounded-lg font-bold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
          >
            Add Song
          </button>
        </div>

        {/* Song List */}
        <div className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-xl p-6 border-2 border-purple-500/50">
          <h2 className="text-2xl font-bold mb-4">All Songs ({songs.length})</h2>
          
          <div className="space-y-3">
            {songs.map(song => (
              <div
                key={song.id}
                className="bg-black/40 rounded-lg p-4 flex justify-between items-center"
              >
                <div>
                  <h3 className="font-bold">{song.title}</h3>
                  <p className="text-sm text-gray-400">{song.artist} • {song.genre} • {song.bpm} BPM</p>
                  <p className="text-xs text-purple-400">
                    Tier {song.unlockTier} {song.requiredStars > 0 && `• ${song.requiredStars} ⭐ required`}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteSong(song.id)}
                  className="bg-red-500/20 hover:bg-red-500/40 px-4 py-2 rounded-lg text-red-400 transition-all"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-900/30 rounded-xl p-6 border border-blue-500/30">
          <h3 className="font-bold text-lg mb-2">💡 How It Works</h3>
          <ul className="text-sm text-gray-300 space-y-2">
            <li>• Add songs with metadata - beatmaps auto-generate on first play</li>
            <li>• Set unlock tier and star requirements to control progression</li>
            <li>• Tier 0 songs are available from the start</li>
            <li>• Higher tiers unlock as players earn stars</li>
            <li>• Audio files are optional (placeholder for future MP3 integration)</li>
            <li>• All data saves automatically to browser localStorage</li>
          </ul>
        </div>
      </div>
    </div>
  );
}