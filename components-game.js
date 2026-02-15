// GameScreen Component - COMPLETELY FIXED
function GameScreen({ song, difficulty, onEnd, onBack }) {
  const [gameState, setGameState] = useState('ready');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [judgments, setJudgments] = useState({ perfect: 0, great: 0, good: 0, miss: 0 });
  const [notes, setNotes] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [beatmap, setBeatmap] = useState(null);
  const [laneFlashes, setLaneFlashes] = useState([false, false, false, false]);
  const [judgmentDisplay, setJudgmentDisplay] = useState(null);
  const [activeTouches, setActiveTouches] = useState({});
  const [activeHolds, setActiveHolds] = useState({}); // {lane: {noteId, startTime}}
  const [failed, setFailed] = useState(false);
  const [waveformBars, setWaveformBars] = useState(Array(20).fill(0.3));
  const gameLoopRef = useRef(null);
  const startTimeRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const map = generateBeatmap(song.bpm, song.duration, difficulty);
    setBeatmap(map);
    setNotes(map.map(n => ({ ...n, hit: false, missed: false, holdStarted: false })));
  }, [song, difficulty]);

  // Animated waveform bars
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const interval = setInterval(() => {
      setWaveformBars(prev => {
        const beatPulse = Math.sin(Date.now() / 100) * 0.3 + 0.5;
        return prev.map(() => Math.random() * 0.4 + beatPulse * 0.3);
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [gameState]);

  const startGame = () => {
    setGameState('playing');
    startTimeRef.current = Date.now();
    
    if (song.audioUrl) {
      audioRef.current = new Audio(song.audioUrl);
      audioRef.current.play().catch(e => console.log('Audio:', e));
    }
    
    gameLoopRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setCurrentTime(elapsed);

      // Check active holds - complete them when duration passes
      setNotes(prev => prev.map(note => {
        if (note.type === GAME_CONFIG.NOTE_TYPES.HOLD && note.holdStarted && !note.hit) {
          if (elapsed >= note.time + note.duration) {
            // Hold completed successfully!
            setActiveHolds(holds => {
              const newHolds = {...holds};
              delete newHolds[note.lane];
              return newHolds;
            });
            
            // Award points
            setScore(s => s + 100 * Math.max(1, combo));
            setCombo(c => c + 1);
            setJudgments(j => ({ ...j, perfect: j.perfect + 1 }));
            flashLane(note.lane);
            
            return { ...note, hit: true };
          }
        }
        return note;
      }));

      // Auto-miss notes that passed
      setNotes(prev => prev.map(note => {
        if (!note.hit && !note.missed && !note.holdStarted) {
          if (elapsed > note.time + GAME_CONFIG.TIMING_WINDOWS.miss) {
            setCombo(0);
            setJudgments(j => ({ ...j, miss: j.miss + 1 }));
            
            // Check fail
            const totalNotes = Object.values(judgments).reduce((a,b) => a + b, 0) + 1;
            const hitNotes = judgments.perfect + judgments.great + judgments.good;
            if (totalNotes > 10 && hitNotes / totalNotes < GAME_CONFIG.FAIL_THRESHOLD) {
              failGame();
            }
            
            return { ...note, missed: true };
          }
        }
        return note;
      }));

      if (elapsed > song.duration * 1000) {
        endGameNow(false);
      }
    }, 16);
  };

  const failGame = () => {
    if (!failed) {
      setFailed(true);
      clearInterval(gameLoopRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setGameState('failed');
    }
  };

  const retryGame = () => {
    setGameState('ready');
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setJudgments({ perfect: 0, great: 0, good: 0, miss: 0 });
    setCurrentTime(0);
    setFailed(false);
    setActiveHolds({});
    setActiveTouches({});
    
    const map = generateBeatmap(song.bpm, song.duration, difficulty);
    setBeatmap(map);
    setNotes(map.map(n => ({ ...n, hit: false, missed: false, holdStarted: false })));
  };

  const endGameNow = (isFailed) => {
    clearInterval(gameLoopRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    
    if (isFailed) {
      setGameState('failed');
    } else {
      setGameState('finished');
    }
    // Results screen will now WAIT for user input (no auto-close)
  };

  const handleContinue = () => {
    const totalNotes = beatmap.length;
    const hitNotes = judgments.perfect + judgments.great + judgments.good;
    const accuracy = totalNotes > 0 ? (hitNotes / totalNotes) * 100 : 0;
    onEnd(score, accuracy, judgments.perfect, judgments.great, judgments.good, judgments.miss, failed);
  };

  const flashLane = (lane) => {
    setLaneFlashes(prev => {
      const n = [...prev];
      n[lane] = true;
      return n;
    });
    setTimeout(() => {
      setLaneFlashes(prev => {
        const n = [...prev];
        n[lane] = false;
        return n;
      });
    }, 200);
  };

  const showJudgment = (text, color) => {
    setJudgmentDisplay({ text, color });
    setTimeout(() => setJudgmentDisplay(null), 600);
  };

  const handleTouchStart = (e, lane) => {
    e.preventDefault();
    e.stopPropagation();
    
    Array.from(e.changedTouches).forEach(touch => {
      setActiveTouches(prev => ({
        ...prev,
        [touch.identifier]: {
          lane,
          startX: touch.clientX,
          startY: touch.clientY,
          startTime: Date.now()
        }
      }));
    });
    
    checkHit(lane, null, true);
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
  };

  const handleTouchEnd = (e, lane) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Release holds in this lane
    const holdInLane = activeHolds[lane];
    if (holdInLane) {
      // Check if released too early
      const note = notes.find(n => n.id === holdInLane.noteId);
      if (note && currentTime < note.time + note.duration) {
        // Released too early = miss
        setNotes(prev => prev.map(n => n.id === holdInLane.noteId ? { ...n, missed: true } : n));
        setCombo(0);
        setJudgments(j => ({ ...j, miss: j.miss + 1 }));
        showJudgment('MISS', 'text-red-500');
      }
      
      setActiveHolds(prev => {
        const newHolds = {...prev};
        delete newHolds[lane];
        return newHolds;
      });
    }
    
    // Check for swipe
    Array.from(e.changedTouches).forEach(touch => {
      const touchData = activeTouches[touch.identifier];
      
      if (touchData && touchData.lane === lane) {
        const dx = touch.clientX - touchData.startX;
        const dy = touch.clientY - touchData.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > GAME_CONFIG.SWIPE_THRESHOLD) {
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          let swipeType = null;
          
          if (angle >= -45 && angle < 45) {
            swipeType = GAME_CONFIG.NOTE_TYPES.SWIPE_RIGHT;
          } else if (angle >= 45 && angle < 135) {
            swipeType = GAME_CONFIG.NOTE_TYPES.SWIPE_DOWN;
          } else if (angle >= -135 && angle < -45) {
            swipeType = GAME_CONFIG.NOTE_TYPES.SWIPE_UP;
          } else {
            swipeType = GAME_CONFIG.NOTE_TYPES.SWIPE_LEFT;
          }
          
          checkHit(lane, swipeType, false);
        }
      }
      
      setActiveTouches(prev => {
        const newTouches = { ...prev };
        delete newTouches[touch.identifier];
        return newTouches;
      });
    });
  };

  const checkHit = (lane, swipeType, isTouchStart) => {
    const hitTime = currentTime;
    let bestNote = null;
    let bestTiming = Infinity;

    notes.forEach(note => {
      if (note.lane === lane && !note.hit && !note.missed && !note.holdStarted) {
        const timing = Math.abs(note.time - hitTime);
        
        if (timing < GAME_CONFIG.TIMING_WINDOWS.miss && timing < bestTiming) {
          // Type matching
          if (swipeType) {
            if (note.type !== swipeType) return;
          } else {
            if (note.type !== GAME_CONFIG.NOTE_TYPES.TAP && 
                note.type !== GAME_CONFIG.NOTE_TYPES.HOLD) return;
          }
          
          bestNote = note;
          bestTiming = timing;
        }
      }
    });

    if (bestNote) {
      let judgment = 'miss', points = 0, text = 'MISS', color = 'text-red-500';
      
      if (bestTiming < GAME_CONFIG.TIMING_WINDOWS.perfect) {
        judgment = 'perfect';
        points = 100;
        text = 'PERFECT+';
        color = 'text-green-400';
      } else if (bestTiming < GAME_CONFIG.TIMING_WINDOWS.great) {
        judgment = 'great';
        points = 75;
        text = 'GREAT';
        color = 'text-cyan-400';
      } else if (bestTiming < GAME_CONFIG.TIMING_WINDOWS.good) {
        judgment = 'good';
        points = 50;
        text = 'GOOD';
        color = 'text-yellow-400';
      }

      if (judgment !== 'miss') {
        if (bestNote.type === GAME_CONFIG.NOTE_TYPES.HOLD && isTouchStart) {
          // Start holding - mark it
          setNotes(prev => prev.map(n => n.id === bestNote.id ? { ...n, holdStarted: true } : n));
          setActiveHolds(prev => ({ 
            ...prev, 
            [lane]: { noteId: bestNote.id, startTime: hitTime }
          }));
          showJudgment(text, color);
        } else {
          // Regular hit
          setNotes(prev => prev.map(n => n.id === bestNote.id ? { ...n, hit: true } : n));
          setScore(s => s + points * Math.max(1, combo));
          setCombo(c => {
            const newCombo = c + 1;
            setMaxCombo(max => Math.max(max, newCombo));
            return newCombo;
          });
          setJudgments(j => ({ ...j, [judgment]: j[judgment] + 1 }));
          flashLane(lane);
          showJudgment(text, color);
        }
      } else {
        setCombo(0);
        setJudgments(j => ({ ...j, miss: j.miss + 1 }));
      }
    }
  };

  // READY SCREEN
  if (gameState === 'ready') {
    return (
      <div className="game-bg min-h-screen flex items-center justify-center text-white p-6">
        <div className="text-center">
          <div className="mb-8">
            <div className="w-32 h-32 mx-auto rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-2xl mb-6">
              <Music />
            </div>
            <h1 className="text-4xl font-black mb-2">{song.title}</h1>
            <p className="text-xl opacity-90 mb-1">{song.artist}</p>
            <p className="text-sm opacity-75">{song.genre}</p>
          </div>
          
          <div className="mb-8 bg-black/30 backdrop-blur rounded-2xl p-6 inline-block">
            <div className="text-sm opacity-75 mb-2">DIFFICULTY</div>
            <div className="text-3xl font-black uppercase">{difficulty}</div>
            <div className="text-sm opacity-75 mt-2">Level {song.difficulty[difficulty]}</div>
          </div>

          <button onClick={startGame} className="bg-white text-purple-900 px-16 py-5 rounded-full text-2xl font-black hover:scale-105 transition-transform shadow-2xl mb-4">
            START
          </button>
          
          <button onClick={onBack} className="block mx-auto text-white/60 hover:text-white transition-colors">
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // FAILED SCREEN - stays until user clicks
  if (gameState === 'failed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-black to-red-900 flex items-center justify-center text-white p-6">
        <div className="text-center max-w-lg">
          <div className="mb-8">
            <div className="text-8xl font-black text-red-500 mb-4 drop-shadow-2xl">FAILED</div>
            <p className="text-2xl text-gray-300 mb-2">Accuracy dropped below 50%</p>
            <p className="text-lg text-gray-400">Keep practicing!</p>
          </div>

          <div className="bg-black/40 backdrop-blur rounded-2xl p-6 mb-8">
            <div className="grid grid-cols-4 gap-3 text-sm mb-4">
              <div className="bg-green-500/20 rounded-xl p-3">
                <div className="text-2xl font-bold text-green-400">{judgments.perfect}</div>
                <div className="text-xs opacity-75">PERFECT+</div>
              </div>
              <div className="bg-cyan-500/20 rounded-xl p-3">
                <div className="text-2xl font-bold text-cyan-400">{judgments.great}</div>
                <div className="text-xs opacity-75">GREAT</div>
              </div>
              <div className="bg-yellow-500/20 rounded-xl p-3">
                <div className="text-2xl font-bold text-yellow-400">{judgments.good}</div>
                <div className="text-xs opacity-75">GOOD</div>
              </div>
              <div className="bg-red-500/20 rounded-xl p-3">
                <div className="text-2xl font-bold text-red-400">{judgments.miss}</div>
                <div className="text-xs opacity-75">MISS</div>
              </div>
            </div>
            <div className="text-sm opacity-75">Score: {score.toLocaleString()}</div>
          </div>

          <div className="space-y-3">
            <button onClick={retryGame} className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white px-12 py-4 rounded-full text-xl font-black transition-all hover:scale-105 shadow-2xl">
              RETRY
            </button>
            <button onClick={handleContinue} className="w-full bg-white text-black px-12 py-4 rounded-full text-xl font-black transition-all hover:scale-105 shadow-2xl">
              CONTINUE
            </button>
          </div>
        </div>
      </div>
    );
  }

  // FINISHED SCREEN - Like Beatstar (stays until user clicks)
  if (gameState === 'finished') {
    const totalNotes = beatmap.length;
    const hitNotes = judgments.perfect + judgments.great + judgments.good;
    const accuracy = totalNotes > 0 ? ((hitNotes / totalNotes) * 100).toFixed(1) : 0;
    const stars = calculateStars(accuracy);
    const perfectPlus = judgments.perfect;
    const perfect = Math.floor(perfectPlus * 0.7); // Simulating perfect+ vs perfect

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-900 via-slate-800 to-amber-900 flex items-center justify-center text-white p-6">
        <div className="text-center max-w-2xl w-full">
          {/* Song Info */}
          <div className="mb-6">
            <h1 className="text-2xl font-black mb-1">{song.title}</h1>
            <p className="text-lg opacity-75">{song.artist}</p>
            <div className="inline-block bg-blue-900/50 px-4 py-1 rounded-full text-sm mt-2">
              {difficulty.toUpperCase()}
            </div>
          </div>

          {/* Circular Score Display */}
          <div className="relative w-64 h-64 mx-auto mb-6">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="128" cy="128" r="115" stroke="rgba(255,255,255,0.1)" strokeWidth="14" fill="rgba(0,0,0,0.6)" />
              <circle cx="128" cy="128" r="115" stroke="white" strokeWidth="14" fill="none"
                strokeDasharray={`${(accuracy / 100) * 722} 722`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-xs opacity-50 mb-1">ginuwine</div>
              <div className="text-lg opacity-75 mb-2">n</div>
              {/* Stars */}
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-8 h-8 ${i < stars ? 'text-yellow-400' : 'text-gray-600'}`} filled={i < stars} />
                ))}
              </div>
              {/* Score */}
              <div className="text-5xl font-black mb-1">{score.toLocaleString()}</div>
              {/* Badges */}
              <div className="flex gap-2 items-center mt-2">
                <div className="w-6 h-6 rounded-full bg-yellow-500" title="Coins" />
                <div className="w-6 h-6 rounded-full bg-purple-500" title="Badge" />
                <div className="bg-black px-3 py-1 rounded-full text-sm">{combo}</div>
                <div className="w-6 h-6 rounded-full bg-blue-300" title="Badge" />
              </div>
              <div className="text-xs opacity-50 mt-2 bg-red-500 px-3 py-1 rounded-full">NEW BEST</div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-black/40 backdrop-blur rounded-2xl p-6 mb-6">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-4xl font-black mb-1">{perfectPlus}</div>
                <div className="text-sm opacity-75">PERFECT+</div>
              </div>
              <div>
                <div className="text-4xl font-black mb-1">{perfect}</div>
                <div className="text-sm opacity-75">PERFECT</div>
              </div>
              <div>
                <div className="text-4xl font-black mb-1">{judgments.good}</div>
                <div className="text-sm opacity-75">GREAT</div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            <button onClick={retryGame} className="w-full bg-transparent border-2 border-white/30 text-white px-12 py-3 rounded-full text-lg font-bold transition-all hover:bg-white/10">
              RETRY
            </button>
            <button onClick={handleContinue} className="w-full bg-white text-black px-12 py-4 rounded-full text-xl font-black transition-all hover:scale-105 shadow-2xl">
              CONTINUE
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PLAYING STATE
  const visibleNotes = notes.filter(note => {
    const position = (currentTime - note.time) * GAME_CONFIG.NOTE_SPEED + GAME_CONFIG.HIT_LINE;
    return position >= -0.3 && position <= 1.05 && !note.hit && !note.missed;
  });

  const progress = Math.min(100, (currentTime / (song.duration * 1000)) * 100);
  const totalPlayed = Object.values(judgments).reduce((a,b) => a + b, 0);
  const hitNotes = judgments.perfect + judgments.great + judgments.good;
  const currentAccuracy = totalPlayed > 0 ? ((hitNotes / totalPlayed) * 100).toFixed(0) : 100;

  return (
    <div className="relative w-full h-screen game-bg overflow-hidden touch-none" style={{touchAction: 'none'}}>
      {/* Top HUD with waveform */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/70 to-transparent p-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {/* Score Circle */}
          <div className="relative w-28 h-28">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="56" cy="56" r="50" stroke="rgba(255,255,255,0.2)" strokeWidth="6" fill="rgba(0,0,0,0.7)" />
              <circle cx="56" cy="56" r="50" stroke={currentAccuracy < 50 ? "#ef4444" : "#a855f7"} strokeWidth="6" fill="none"
                strokeDasharray={`${(progress / 100) * 314} 314`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
              <div className="text-xs opacity-75">STAGE</div>
              <div className="text-2xl font-black">{(score / 1000).toFixed(1)}K</div>
              <div className="text-xs opacity-75">×{combo}</div>
            </div>
          </div>

          {/* Waveform Bars */}
          <div className="flex-1 mx-6 flex items-center gap-0.5 h-8">
            {waveformBars.map((height, i) => (
              <div key={i} className="flex-1 bg-white/30 rounded-full transition-all duration-75"
                style={{ height: `${height * 100}%` }} />
            ))}
          </div>

          {/* Pause */}
          <button onClick={onBack} className="w-14 h-14 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
          </button>
        </div>
      </div>

      {/* Judgment */}
      {judgmentDisplay && (
        <div className="absolute top-1/3 left-0 right-0 z-40 flex justify-center pointer-events-none">
          <div className={`judgment-text text-7xl font-black ${judgmentDisplay.color} drop-shadow-2xl`}>
            {judgmentDisplay.text}
          </div>
        </div>
      )}

      {/* Game Field */}
      <div className="absolute inset-0 flex justify-center items-end pb-8">
        <div className="w-full max-w-4xl h-full relative">
          {/* Hit Panel */}
          <div className="absolute left-0 right-0 z-10 pointer-events-none"
            style={{
              top: `${GAME_CONFIG.HIT_PANEL_START * 100}%`,
              height: `${GAME_CONFIG.HIT_PANEL_HEIGHT * 100}%`,
              background: 'linear-gradient(to bottom, rgba(127,29,29,0.3), rgba(153,27,27,0.6), rgba(127,29,29,0.3))',
              borderTop: '3px solid rgba(255,255,255,0.5)',
              borderBottom: '3px solid rgba(255,255,255,0.5)',
              boxShadow: 'inset 0 3px 40px rgba(255,255,255,0.2)'
            }}>
            <div className="absolute bottom-3 left-0 right-0 text-center text-white/15 text-sm font-bold tracking-[0.5em]">
              - P E R F E C T -
            </div>
          </div>

          {/* Lane Borders */}
          <div className="absolute inset-0 flex pointer-events-none z-5">
            {[...Array(GAME_CONFIG.LANES)].map((_, i) => (
              <div key={i} className="flex-1 relative">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-white/20" />
              </div>
            ))}
            <div className="absolute right-0 top-0 bottom-0 w-px bg-white/20" />
          </div>

          {/* Interactive Lanes */}
          {[...Array(GAME_CONFIG.LANES)].map((_, lane) => (
            <div key={lane}
              className={`absolute top-0 bottom-0 z-20 ${laneFlashes[lane] ? 'lane-flash' : ''}`}
              style={{ left: `${(lane / GAME_CONFIG.LANES) * 100}%`, width: `${100 / GAME_CONFIG.LANES}%` }}
              onTouchStart={(e) => handleTouchStart(e, lane)}
              onTouchMove={handleTouchMove}
              onTouchEnd={(e) => handleTouchEnd(e, lane)}
              onClick={() => checkHit(lane, null, true)}>
              
              {/* NOTES - CORRECT DIMENSIONS & HOLD DESIGN */}
              {visibleNotes.filter(note => note.lane === lane).map(note => {
                const position = ((currentTime - note.time) * GAME_CONFIG.NOTE_SPEED + GAME_CONFIG.HIT_LINE) * 100;
                const isHold = note.type === GAME_CONFIG.NOTE_TYPES.HOLD;
                const isActiveHold = activeHolds[lane]?.noteId === note.id;

                // For hold notes, render trail above the tile
                const holdTrailHeight = isHold ? (note.duration / song.bpm) * 600 : 0; // Trail length

                return (
                  <React.Fragment key={note.id}>
                    {/* HOLD TRAIL (green vertical line above tile) */}
                    {isHold && (
                      <div className="absolute flex justify-center pointer-events-none"
                        style={{
                          bottom: `${100 - position}%`,
                          left: `${(1 - GAME_CONFIG.NOTE_WIDTH_RATIO) * 50}%`,
                          right: `${(1 - GAME_CONFIG.NOTE_WIDTH_RATIO) * 50}%`,
                          height: `${holdTrailHeight}px`,
                          transform: 'translateY(50%)'
                        }}>
                        <div className={`w-2 h-full rounded-full ${isActiveHold ? 'bg-green-400' : 'bg-green-500/60'}`}
                          style={{
                            boxShadow: isActiveHold ? '0 0 20px rgba(74,222,128,0.8)' : '0 0 10px rgba(74,222,128,0.4)'
                          }} />
                      </div>
                    )}

                    {/* NOTE TILE (taller than wide) */}
                    <div className="absolute flex items-center justify-center pointer-events-none"
                      style={{
                        top: `${position}%`,
                        left: `${(1 - GAME_CONFIG.NOTE_WIDTH_RATIO) * 50}%`,
                        right: `${(1 - GAME_CONFIG.NOTE_WIDTH_RATIO) * 50}%`,
                        transform: 'translateY(-50%)',
                        height: `${GAME_CONFIG.NOTE_HEIGHT}px`
                      }}>
                      
                      {/* TAP NOTE */}
                      {(note.type === GAME_CONFIG.NOTE_TYPES.TAP || note.type === GAME_CONFIG.NOTE_TYPES.HOLD) && (
                        <div className="w-full h-full rounded-2xl bg-gradient-to-b from-slate-500 via-slate-700 to-black shadow-2xl flex items-center justify-center relative overflow-hidden"
                          style={{
                            border: '3px solid rgba(255,255,255,0.7)',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.9), inset 0 -4px 8px rgba(0,0,0,0.5), inset 0 4px 8px rgba(255,255,255,0.2)',
                            transform: 'perspective(800px) rotateX(8deg)'
                          }}>
                          {/* Glossy top */}
                          <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl" />
                          {/* White horizontal line */}
                          <div className="w-4/5 h-2.5 bg-white rounded-full shadow-lg relative z-10" 
                            style={{boxShadow: '0 0 15px rgba(255,255,255,0.9), 0 2px 4px rgba(0,0,0,0.5)'}} />
                        </div>
                      )}

                      {/* SWIPE UP */}
                      {note.type === GAME_CONFIG.NOTE_TYPES.SWIPE_UP && (
                        <div className="w-full h-full rounded-2xl bg-gradient-to-b from-slate-500 via-slate-700 to-black flex items-center justify-center shadow-2xl relative overflow-hidden"
                          style={{
                            border: '3px solid rgba(34,211,238,0.9)',
                            boxShadow: '0 10px 40px rgba(34,211,238,0.8), inset 0 -4px 8px rgba(0,0,0,0.5), inset 0 4px 8px rgba(34,211,238,0.3)',
                            transform: 'perspective(800px) rotateX(8deg)'
                          }}>
                          <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl" />
                          <svg className="w-28 h-28 text-white drop-shadow-2xl relative z-10" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l-10 10h6v10h8V12h6z" />
                          </svg>
                        </div>
                      )}

                      {/* SWIPE DOWN */}
                      {note.type === GAME_CONFIG.NOTE_TYPES.SWIPE_DOWN && (
                        <div className="w-full h-full rounded-2xl bg-gradient-to-b from-slate-500 via-slate-700 to-black flex items-center justify-center shadow-2xl relative overflow-hidden"
                          style={{
                            border: '3px solid rgba(74,222,128,0.9)',
                            boxShadow: '0 10px 40px rgba(74,222,128,0.8), inset 0 -4px 8px rgba(0,0,0,0.5), inset 0 4px 8px rgba(74,222,128,0.3)',
                            transform: 'perspective(800px) rotateX(8deg)'
                          }}>
                          <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl" />
                          <svg className="w-28 h-28 text-white drop-shadow-2xl relative z-10" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 22l10-10h-6V2H8v10H2z" />
                          </svg>
                        </div>
                      )}

                      {/* SWIPE LEFT */}
                      {note.type === GAME_CONFIG.NOTE_TYPES.SWIPE_LEFT && (
                        <div className="w-full h-full rounded-2xl bg-gradient-to-b from-slate-500 via-slate-700 to-black flex items-center justify-center shadow-2xl relative overflow-hidden"
                          style={{
                            border: '3px solid rgba(248,113,113,0.9)',
                            boxShadow: '0 10px 40px rgba(248,113,113,0.8), inset 0 -4px 8px rgba(0,0,0,0.5), inset 0 4px 8px rgba(248,113,113,0.3)',
                            transform: 'perspective(800px) rotateX(8deg)'
                          }}>
                          <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl" />
                          <svg className="w-28 h-28 text-white drop-shadow-2xl relative z-10" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M2 12l10-10v6h10v8H12v6z" />
                          </svg>
                        </div>
                      )}

                      {/* SWIPE RIGHT */}
                      {note.type === GAME_CONFIG.NOTE_TYPES.SWIPE_RIGHT && (
                        <div className="w-full h-full rounded-2xl bg-gradient-to-b from-slate-500 via-slate-700 to-black flex items-center justify-center shadow-2xl relative overflow-hidden"
                          style={{
                            border: '3px solid rgba(192,132,252,0.9)',
                            boxShadow: '0 10px 40px rgba(192,132,252,0.8), inset 0 -4px 8px rgba(0,0,0,0.5), inset 0 4px 8px rgba(192,132,252,0.3)',
                            transform: 'perspective(800px) rotateX(8deg)'
                          }}>
                          <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl" />
                          <svg className="w-28 h-28 text-white drop-shadow-2xl relative z-10" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M22 12l-10 10v-6H2V8h10V2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
