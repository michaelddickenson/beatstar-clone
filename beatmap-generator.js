// Enhanced Beatmap Generator
const generateBeatmap = (bpm, duration, difficulty) => {
  const notes = [];
  const beatInterval = (60 / bpm) * 1000;
  
  // Difficulty configurations
  const config = {
    easy: {
      density: 0.40,
      holds: 0.08,
      swipes: 0.12,
      doubles: 0.05,
      triples: 0,
      quads: 0
    },
    normal: {
      density: 0.60,
      holds: 0.15,
      swipes: 0.25,
      doubles: 0.15,
      triples: 0.05,
      quads: 0
    },
    hard: {
      density: 0.85,
      holds: 0.20,
      swipes: 0.30,
      doubles: 0.25,
      triples: 0.15,
      quads: 0.05
    }
  }[difficulty] || {
    density: 0.60,
    holds: 0.15,
    swipes: 0.25,
    doubles: 0.15,
    triples: 0.05,
    quads: 0
  };
  
  let time = 3000;
  const endTime = duration * 1000 - 3000;
  let lastLanes = [];
  
  while (time < endTime) {
    // Snap to beat
    const onBeat = Math.round(time / beatInterval) * beatInterval;
    time = onBeat;
    
    const multiRoll = Math.random();
    let numNotes = 1;
    
    // Determine number of simultaneous notes
    if (multiRoll < config.quads && GAME_CONFIG.LANES >= 4) {
      numNotes = 4;
    } else if (multiRoll < config.quads + config.triples && GAME_CONFIG.LANES >= 3) {
      numNotes = 3;
    } else if (multiRoll < config.quads + config.triples + config.doubles) {
      numNotes = 2;
    }
    
    // Generate lanes (avoid repeating same lanes)
    const availableLanes = [...Array(GAME_CONFIG.LANES)].map((_, i) => i);
    const selectedLanes = [];
    
    for (let i = 0; i < numNotes; i++) {
      const filtered = availableLanes.filter(l => !lastLanes.includes(l) || availableLanes.length <= 2);
      const lane = filtered.length > 0 
        ? filtered[Math.floor(Math.random() * filtered.length)]
        : availableLanes[Math.floor(Math.random() * availableLanes.length)];
      
      selectedLanes.push(lane);
      const index = availableLanes.indexOf(lane);
      if (index > -1) availableLanes.splice(index, 1);
    }
    
    // Generate notes for each lane
    selectedLanes.forEach((lane, index) => {
      const typeRoll = Math.random();
      let noteType = GAME_CONFIG.NOTE_TYPES.TAP;
      
      // First note in multi-note can be any type
      // Others are usually taps for playability
      if (index === 0 || numNotes === 1) {
        if (typeRoll < config.holds) {
          noteType = GAME_CONFIG.NOTE_TYPES.HOLD;
        } else if (typeRoll < config.holds + config.swipes) {
          const swipeTypes = [
            GAME_CONFIG.NOTE_TYPES.SWIPE_UP,
            GAME_CONFIG.NOTE_TYPES.SWIPE_DOWN,
            GAME_CONFIG.NOTE_TYPES.SWIPE_LEFT,
            GAME_CONFIG.NOTE_TYPES.SWIPE_RIGHT
          ];
          noteType = swipeTypes[Math.floor(Math.random() * swipeTypes.length)];
        }
      }
      
      notes.push({
        id: `note-${time}-${lane}-${index}`,
        lane,
        time,
        type: noteType,
        duration: noteType === GAME_CONFIG.NOTE_TYPES.HOLD ? beatInterval * 2.5 : 0
      });
    });
    
    lastLanes = selectedLanes;
    time += beatInterval / config.density;
  }
  
  return notes;
};