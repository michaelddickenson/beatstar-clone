// GameScreen Component
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
  const [activeHolds, setActiveHolds] = useState(new Set());
  const [failed, setFailed] = useState(false);
  const gameLoopRef = useRef(null);
  const startTimeRef = useRef(null);
  const audioRef = useRef(null);
  const laneRefs = useRef([]);

  useEffect(() => {
    const map = generateBeatmap(song.bpm, song.duration, difficulty);
    setBeatmap(map);
    setNotes(map.map(n => ({ ...n, hit: false, missed: false })));
    laneRefs.current = [...Array(GAME_CONFIG.LANES)].map(() => React.createRef());
  }, [song, difficulty]);

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

      // Auto-miss notes that passed
      setNotes(prev => prev.map(note => {
        if (!note.hit && !note.missed && elapsed > note.time + GAME_CONFIG.TIMING_WINDOWS.miss) {
          setCombo(0);
          setJudgments(j => ({ ...j, miss: j.miss + 1 }));
          
          // Check for fail condition
          const totalNotes = j.perfect + j.great + j.good + j.miss + 1;
          const hitNotes = j.perfect + j.great + j.good;
          const accuracy = hitNotes / totalNotes;
          
          if (accuracy < GAME_CONFIG.FAIL_THRESHOLD && totalNotes > 10) {
            failGame();
          }
          
          return { ...note, missed: true };
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
      showJudgment('FAILED!', 'text-red-600');
      setTimeout(() => endGameNow(true), 1500);
    }
  };

  const endGameNow = (isFailed) => {
    clearInterval(gameLoopRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setGameState('finished');
    
    const totalNotes = beatmap.length;
    const hitNotes = judgments.perfect + judgments.great + judgments.good;
    const accuracy = totalNotes > 0 ? (hitNotes / totalNotes) * 100 : 0;
    
    setTimeout(() => {
      onEnd(score, accuracy, judgments.perfect, judgments.great, judgments.good, judgments.miss, isFailed);
    }, 2000);
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
    
    checkHit(lane, null);
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
  };

  const handleTouchEnd = (e, lane) => {
    e.preventDefault();
    e.stopPropagation();
    
    Array.from(e.changedTouches).forEach(touch => {
      const touchData = activeTouches[touch.identifier];
      
      if (touchData && touchData.lane === lane) {
        const dx = touch.clientX - touchData.startX;
        const dy = touch.clientY - touchData.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > GAME_CONFIG.SWIPE_THRESHOLD) {
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          let swipeType = null;
          
          // All 4 directions
          if (angle >= -45 && angle < 45) {
            swipeType = GAME_CONFIG.NOTE_TYPES.SWIPE_RIGHT;
          } else if (angle >= 45 && angle < 135) {
            swipeType = GAME_CONFIG.NOTE_TYPES.SWIPE_DOWN;
          } else if (angle >= -135 && angle < -45) {
            swipeType = GAME_CONFIG.NOTE_TYPES.SWIPE_UP;
          } else {
            swipeType = GAME_CONFIG.NOTE_TYPES.SWIPE_LEFT;
          }
          
          checkHit(lane, swipeType);
        }
      }
      
      setActiveTouches(prev => {
        const newTouches = { ...prev };
        delete newTouches[touch.identifier];
        return newTouches;
      });
    });
  };

  const checkHit = (lane, swipeType) => {
    const hitTime = currentTime;
    let bestNote = null;
    let bestTiming = Infinity;

    notes.forEach(note => {
      if (note.lane === lane && !note.hit && !note.missed) {
        const timing = Math.abs(note.time - hitTime);
        
        if (timing < GAME_CONFIG.TIMING_WINDOWS.miss && timing < bestTiming) {
          // Type checking
          if (swipeType) {
            // Must match swipe type
            if (note.type !== swipeType) return;
          } else {
            // Tap or hold only
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

        if (bestNote.type === GAME_CONFIG.NOTE_TYPES.HOLD) {
          setActiveHolds(prev => new Set([...prev, bestNote.id]));
        }
      } else {
        setCombo(0);
        setJudgments(j => ({ ...j, miss: j.miss + 1 }));
        
        // Check fail
        const totalNotes = Object.values(judgments).reduce((a, b) => a + b, 0) + 1;
        const hitNotes = judgments.perfect + judgments.great + judgments.good;
        if (hitNotes / totalNotes < GAME_CONFIG.FAIL_THRESHOLD && totalNotes > 10) {
          failGame();
        }
      }
    }
  };

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

  if (gameState === 'finished') {
    const totalNotes = beatmap.length;
    const hitNotes = judgments.perfect + judgments.great + judgments.good;
    const accuracy = totalNotes > 0 ? ((hitNotes / totalNotes) * 100).toFixed(1) : 0;
    const stars = calculateStars(accuracy);

    return (
      <div className="game-bg min-h-screen flex items-center justify-center text-white p-6">
        <div className="text-center max-w-lg">
          {failed ? (
            <div className="mb-8">
              <h1 className="text-6xl font-black text-red-500 mb-4">FAILED</h1>
              <p className="text-xl text-gray-300">Accuracy dropped below 50%</p>
            </div>
          ) : (
            <>
              <div className="relative w-56 h-56 mx-auto mb-8">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="112" cy="112" r="100" stroke="rgba(255,255,255,0.1)" strokeWidth="12" fill="rgba(0,0,0,0.5)" />
                  <circle cx="112" cy="112" r="100" stroke="white" strokeWidth="12" fill="none"
                    strokeDasharray={`${(accuracy / 100) * 628} 628`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-sm opacity-75">FINAL SCORE</div>
                  <div className="text-5xl font-black my-2">{score.toLocaleString()}</div>
                  <div className="text-lg opacity-75">{accuracy}%</div>
                </div>
              </div>

              <div className="flex justify-center gap-2 mb-8">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-14 h-14 ${i < stars ? 'text-yellow-400' : 'text-gray-600'}`} filled={i < stars} />
                ))}
              </div>
            </>
          )}

          <div className="bg-black/30 backdrop-blur rounded-2xl p-6">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="bg-green-500/20 rounded-xl p-3">
                <div className="text-3xl font-bold text-green-400">{judgments.perfect}</div>
                <div className="text-xs opacity-75 mt-1">PERFECT</div>
              </div>
              <div className="bg-cyan-500/20 rounded-xl p-3">
                <div className="text-3xl font-bold text-cyan-400">{judgments.great}</div>
                <div className="text-xs opacity-75 mt-1">GREAT</div>
              </div>
              <div className="bg-yellow-500/20 rounded-xl p-3">
                <div className="text-3xl font-bold text-yellow-400">{judgments.good}</div>
                <div className="text-xs opacity-75 mt-1">GOOD</div>
              </div>
              <div className="bg-red-500/20 rounded-xl p-3">
                <div className="text-3xl font-bold text-red-400">{judgments.miss}</div>
                <div className="text-xs opacity-75 mt-1">MISS</div>
              </div>
            </div>
            <div className="text-sm opacity-75 mt-4">Max Combo: {maxCombo}</div>
          </div>
        </div>
      </div>
    );
  }

  // PLAYING STATE
  const visibleNotes = notes.filter(note => {
    const position = (currentTime - note.time) * GAME_CONFIG.NOTE_SPEED + GAME_CONFIG.HIT_LINE;
    return position >= -0.2 && position <= 1.05 && !note.hit && !note.missed;
  });

  const progress = Math.min(100, (currentTime / (song.duration * 1000)) * 100);
  const totalNotes = beatmap.length;
  const hitNotes = judgments.perfect + judgments.great + judgments.good;
  const currentAccuracy = totalNotes > 0 ? ((hitNotes / Math.max(1, Object.values(judgments).reduce((a,b) => a + b, 0))) * 100).toFixed(0) : 100;

  return (
    <div className="relative w-full h-screen game-bg overflow-hidden touch-none" style={{touchAction: 'none'}}>
      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/70 to-transparent p-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="relative w-28 h-28">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="56" cy="56" r="50" stroke="rgba(255,255,255,0.2)" strokeWidth="6" fill="rgba(0,0,0,0.7)" />
              <circle cx="56" cy="56" r="50" stroke={currentAccuracy < 50 ? "#ef4444" : "white"} strokeWidth="6" fill="none"
                strokeDasharray={`${(progress / 100) * 314} 314`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
              <div className="text-xs opacity-75">STAGE {difficulty === 'easy' ? '1' : difficulty === 'normal' ? '2' : '3'}</div>
              <div className="text-2xl font-black">{(score / 1000).toFixed(1)}K</div>
              <div className="text-xs opacity-75">×{combo}</div>
            </div>
          </div>

          <div className="text-center">
            <div className={`text-3xl font-black ${currentAccuracy < 50 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
              {currentAccuracy}%
            </div>
            <div className="text-xs text-gray-400">Accuracy</div>
          </div>

          <button onClick={onBack} className="w-14 h-14 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white hover:bg-black/80 transition-colors">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
          </button>
        </div>
      </div>

      {/* Judgment Display */}
      {judgmentDisplay && (
        <div className="absolute top-1/3 left-0 right-0 z-40 flex justify-center pointer-events-none">
          <div className={`judgment-text text-7xl font-black ${judgmentDisplay.color} drop-shadow-2xl`} style={{textShadow: '0 0 30px rgba(0,0,0,0.8)'}}>
            {judgmentDisplay.text}
          </div>
        </div>
      )}

      {/* Game Field */}
      <div className="absolute inset-0 flex justify-center items-end pb-8">
        <div className="w-full max-w-4xl h-full relative">
          {/* Hit Panel - Like screenshot */}
          <div className="absolute left-0 right-0 z-10 pointer-events-none bg-gradient-to-b from-red-900/30 via-red-800/50 to-red-900/30 border-y-4 border-white/40"
            style={{
              top: `${GAME_CONFIG.HIT_PANEL_START * 100}%`,
              height: `${GAME_CONFIG.HIT_PANEL_HEIGHT * 100}%`,
              boxShadow: 'inset 0 3px 40px rgba(255,255,255,0.2), 0 0 50px rgba(255,255,255,0.15)'
            }}>
            <div className="absolute bottom-3 left-0 right-0 text-center text-white/15 text-sm font-bold tracking-[0.5em]">
              - P E R F E C T -
            </div>
          </div>

          {/* Lane Borders */}
          <div className="absolute inset-0 flex pointer-events-none z-5">
            {[...Array(GAME_CONFIG.LANES)].map((_, i) => (
              <div key={i} className="flex-1 relative">
                {i === 0 && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-transparent via-white/50 to-transparent opacity-90" />}
                {i === GAME_CONFIG.LANES - 1 && <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-transparent via-white/50 to-transparent opacity-90" />}
                {i < GAME_CONFIG.LANES - 1 && <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white/25" />}
              </div>
            ))}
          </div>

          {/* Interactive Lanes */}
          {[...Array(GAME_CONFIG.LANES)].map((_, lane) => (
            <div key={lane} ref={el => laneRefs.current[lane] = el}
              className={`absolute top-0 bottom-0 z-20 ${laneFlashes[lane] ? 'lane-flash' : ''}`}
              style={{ left: `${(lane / GAME_CONFIG.LANES) * 100}%`, width: `${100 / GAME_CONFIG.LANES}%` }}
              onTouchStart={(e) => handleTouchStart(e, lane)}
              onTouchMove={handleTouchMove}
              onTouchEnd={(e) => handleTouchEnd(e, lane)}
              onClick={() => checkHit(lane, null)}>
              
              {/* Render Notes */}
              {visibleNotes.filter(note => note.lane === lane).map(note => {
                const position = ((currentTime - note.time) * GAME_CONFIG.NOTE_SPEED + GAME_CONFIG.HIT_LINE) * 100;
                const isHold = note.type === GAME_CONFIG.NOTE_TYPES.HOLD;
                const noteH = isHold ? GAME_CONFIG.NOTE_HEIGHT * GAME_CONFIG.HOLD_MULTIPLIER : GAME_CONFIG.NOTE_HEIGHT;

                return (
                  <div key={note.id} className="absolute flex items-center justify-center pointer-events-none"
                    style={{
                      top: `${position}%`,
                      left: `${(1 - GAME_CONFIG.NOTE_WIDTH_RATIO) * 50}%`,
                      right: `${(1 - GAME_CONFIG.NOTE_WIDTH_RATIO) * 50}%`,
                      transform: 'translateY(-50%)',
                      height: `${noteH}px`
                    }}>
                    
                    {/* TAP NOTE - Like screenshot */}
                    {note.type === GAME_CONFIG.NOTE_TYPES.TAP && (
                      <div className="w-full h-full rounded-3xl bg-gradient-to-b from-slate-600 via-slate-800 to-black border-4 border-white/80 shadow-2xl flex items-center justify-center"
                        style={{
                          boxShadow: '0 8px 40px rgba(0,0,0,0.9), inset 0 4px 20px rgba(255,255,255,0.2)'
                        }}>
                        <div className="w-4/5 h-2 bg-white/95 rounded-full shadow-lg" style={{boxShadow: '0 0 10px rgba(255,255,255,0.8)'}} />
                      </div>
                    )}

                    {/* HOLD NOTE - Taller with multiple lines */}
                    {isHold && (
                      <div className="w-full h-full rounded-3xl bg-gradient-to-b from-yellow-400 via-orange-500 to-orange-700 border-4 border-yellow-200 shadow-2xl flex flex-col items-center justify-around py-4"
                        style={{
                          boxShadow: '0 8px 40px rgba(251,191,36,0.8), inset 0 4px 20px rgba(255,255,255,0.3)'
                        }}>
                        {[...Array(7)].map((_, i) => (
                          <div key={i} className="w-4/5 h-2 bg-white/95 rounded-full shadow-md" />
                        ))}
                      </div>
                    )}

                    {/* SWIPE UP */}
                    {note.type === GAME_CONFIG.NOTE_TYPES.SWIPE_UP && (
                      <div className="w-full h-full rounded-3xl bg-gradient-to-b from-slate-600 via-slate-800 to-black border-4 border-cyan-300 flex items-center justify-center shadow-2xl"
                        style={{boxShadow: '0 8px 40px rgba(34,211,238,0.8), inset 0 4px 20px rgba(34,211,238,0.3)'}}>
                        <svg className="w-24 h-24 text-white drop-shadow-2xl" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l-10 10h6v10h8V12h6z" />
                        </svg>
                      </div>
                    )}

                    {/* SWIPE DOWN */}
                    {note.type === GAME_CONFIG.NOTE_TYPES.SWIPE_DOWN && (
                      <div className="w-full h-full rounded-3xl bg-gradient-to-b from-slate-600 via-slate-800 to-black border-4 border-green-300 flex items-center justify-center shadow-2xl"
                        style={{boxShadow: '0 8px 40px rgba(74,222,128,0.8), inset 0 4px 20px rgba(74,222,128,0.3)'}}>
                        <svg className="w-24 h-24 text-white drop-shadow-2xl" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 22l10-10h-6V2H8v10H2z" />
                        </svg>
                      </div>
                    )}

                    {/* SWIPE LEFT */}
                    {note.type === GAME_CONFIG.NOTE_TYPES.SWIPE_LEFT && (
                      <div className="w-full h-full rounded-3xl bg-gradient-to-b from-slate-600 via-slate-800 to-black border-4 border-red-300 flex items-center justify-center shadow-2xl"
                        style={{boxShadow: '0 8px 40px rgba(248,113,113,0.8), inset 0 4px 20px rgba(248,113,113,0.3)'}}>
                        <svg className="w-24 h-24 text-white drop-shadow-2xl" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M2 12l10-10v6h10v8H12v6z" />
                        </svg>
                      </div>
                    )}

                    {/* SWIPE RIGHT */}
                    {note.type === GAME_CONFIG.NOTE_TYPES.SWIPE_RIGHT && (
                      <div className="w-full h-full rounded-3xl bg-gradient-to-b from-slate-600 via-slate-800 to-black border-4 border-purple-300 flex items-center justify-center shadow-2xl"
                        style={{boxShadow: '0 8px 40px rgba(192,132,252,0.8), inset 0 4px 20px rgba(192,132,252,0.3)'}}>
                        <svg className="w-24 h-24 text-white drop-shadow-2xl" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M22 12l-10 10v-6H2V8h10V2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
