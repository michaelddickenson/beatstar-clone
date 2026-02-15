// React Components
const { useState, useEffect, useRef } = React;

// Icons
const Star = ({className = "w-5 h-5", filled = false}) => (
  <svg className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

const Lock = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;
const Music = () => <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>;
const Heart = ({filled}) => <svg className="w-6 h-6" fill={filled ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>;

// Main App Component
function BeatstarClone() {
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState('home');
  const [player, setPlayer] = useState(() => {
    try {
      const saved = localStorage.getItem('beatstar-player');
      return saved ? JSON.parse(saved) : INITIAL_PLAYER;
    } catch (e) {
      return INITIAL_PLAYER;
    }
  });
  const [songs, setSongs] = useState([]);
  const [selectedSong, setSelectedSong] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState('normal');

  useEffect(() => {
    loadSongs().then(loadedSongs => {
      setSongs(loadedSongs);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('beatstar-player', JSON.stringify(player));
    } catch (e) {
      console.error('Save failed:', e);
    }
  }, [player]);

  const isSongUnlocked = (song) => player.unlockedSongs.includes(song.id);
  
  const canUnlockSong = (song) => {
    if (isSongUnlocked(song)) return false;
    return !song.requiredStars || player.totalStars >= song.requiredStars;
  };

  const unlockSong = (songId) => {
    setPlayer(prev => ({
      ...prev,
      unlockedSongs: [...new Set([...prev.unlockedSongs, songId])]
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

  const endGame = (score, accuracy, perfect, great, good, miss, failed) => {
    const stars = calculateStars(accuracy);
    const currencyEarned = calculateCurrency(stars, selectedDifficulty);
    const scoreKey = `${selectedSong.id}-${selectedDifficulty}`;
    const previousBest = player.scores[scoreKey];
    const isNewBest = !previousBest || score > previousBest.score;

    setPlayer(prev => {
      const newScores = { ...prev.scores };
      if (isNewBest && !failed) {
        newScores[scoreKey] = { score, stars, accuracy, perfect, great, good, miss };
      }
      const newTotalStars = Object.values(newScores).reduce((sum, s) => sum + s.stars, 0);
      return {
        ...prev,
        scores: newScores,
        totalStars: newTotalStars,
        currency: prev.currency + (failed ? 0 : currencyEarned)
      };
    });

    setCurrentScreen('home');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-2xl font-bold animate-pulse">Loading...</div>
      </div>
    );
  }

  if (currentScreen === 'game' && selectedSong) {
    return <GameScreen song={selectedSong} difficulty={selectedDifficulty} onEnd={endGame} onBack={() => setCurrentScreen('home')} />;
  }

  // HOME SCREEN
  const unlockedSongs = songs.filter(isSongUnlocked);
  const lockedSongs = songs.filter(s => !isSongUnlocked(s));
  const canUnlock = lockedSongs.filter(canUnlockSong);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-xl border-b border-white/10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              COLLECTION
            </h1>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 px-4 py-2 rounded-full border border-yellow-500/30">
                <span className="text-2xl">💰</span>
                <span className="font-bold text-yellow-300">{player.currency}</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-6 text-sm">
            <div className="text-gray-400">{songs.length} SONGS</div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-purple-400" filled />
              <span className="text-gray-300">{player.totalStars}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Unlocked Songs */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">🎵 Your Songs</h2>
          
          <div className="space-y-3">
            {unlockedSongs.map(song => {
              const scoreKey = `${song.id}-normal`;
              const songScore = player.scores[scoreKey];
              const inWishlist = player.wishlist.includes(song.id);

              return (
                <div key={song.id} className="group bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-2xl p-4 border border-purple-500/30 hover:border-purple-400/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                      <Music />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-white truncate">{song.title}</h3>
                      <p className="text-sm text-gray-300">{song.artist}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 bg-purple-500/30 rounded-full text-purple-200">{song.genre}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {songScore && (
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className="w-5 h-5 text-yellow-400" filled={i < songScore.stars} />
                          ))}
                        </div>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); toggleWishlist(song.id); }} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                        <Heart filled={inWishlist} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {['easy', 'normal', 'hard'].map(diff => {
                      const key = `${song.id}-${diff}`;
                      const score = player.scores[key];
                      
                      return (
                        <button key={diff} onClick={() => startGame(song, diff)} className="bg-black/40 hover:bg-black/60 rounded-xl p-3 transition-all text-left border border-white/10 hover:scale-105">
                          <div className="text-xs font-bold uppercase text-purple-300 mb-1">{diff}</div>
                          {score && (
                            <div className="flex gap-0.5">
                              {[...Array(score.stars)].map((_, i) => (
                                <Star key={i} className="w-3 h-3 text-yellow-400" filled />
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Locked Songs */}
        {lockedSongs.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Lock />
              <h2 className="text-xl font-bold text-white">Locked Songs</h2>
              {canUnlock.length > 0 && (
                <span className="text-sm text-green-400 font-bold">({canUnlock.length} ready!)</span>
              )}
            </div>
            
            <div className="space-y-3">
              {lockedSongs.map(song => {
                const canUnlockThis = canUnlockSong(song);
                const inWishlist = player.wishlist.includes(song.id);

                return (
                  <div key={song.id} className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <Lock />
                      </div>

                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-400">???</h3>
                        <p className="text-sm text-gray-500">Locked</p>
                        {song.requiredStars && (
                          <div className={`text-sm mt-1 ${canUnlockThis ? 'text-green-400 font-bold' : 'text-gray-500'}`}>
                            {canUnlockThis ? `✓ Ready! (${song.requiredStars} ⭐)` : `Requires ${song.requiredStars} ⭐`}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {canUnlockThis && (
                          <button onClick={() => unlockSong(song.id)} className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-full font-bold transition-all">
                            Unlock
                          </button>
                        )}
                        <button onClick={() => toggleWishlist(song.id)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                          <Heart filled={inWishlist} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}