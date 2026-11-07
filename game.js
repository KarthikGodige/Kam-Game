/**
 * Bro's Downfall | The Ultimate Revenge Meme Game
 * Pure Vanilla HTML5 Canvas + Web Audio API + Web Speech Synthesis
 * Zero external dependencies, runs directly in any browser!
 */

// Canvas roundRect Polyfill for safe cross-browser support
if (CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r = 0) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

// ==========================================
// 1. GAME CONSTANTS & CONFIGURATION
// ==========================================
const CONFIG = {
  CANVAS_VIRTUAL_WIDTH: 460,
  CANVAS_VIRTUAL_HEIGHT: 740,
  GRAVITY: 0.32,
  JUMP_FORCE: -7.2,
  MAX_FALL_SPEED: 8.5,
  BASE_SPEED: 2.2,
  MAX_SPEED: 4.8,
  SPEED_INCREMENT: 0.04,
  PIPE_WIDTH: 74,
  PIPE_SPAWN_DIST: 290,
  INITIAL_GAP: 195,
  MIN_GAP: 145,
  GAP_DECREMENT: 0.8,
  BIRD_DEFAULT_RADIUS: 24,
  LOCAL_STORAGE_KEYS: {
    BEST_SCORE: 'bro_revenge_best_score_v1',
    FRIEND_NAME: 'bro_revenge_friend_name_v1',
    FRIEND_AVATAR: 'bro_revenge_friend_avatar_v1',
    FRIEND_PROP: 'bro_revenge_friend_prop_v1',
    OBSTACLE_STYLE: 'bro_revenge_obstacle_style_v1',
    VOICE_ENABLED: 'bro_revenge_voice_enabled_v1',
    TOTAL_DEATHS: 'bro_revenge_total_deaths_v1',
    CUSTOM_BG_VIDEO: 'bro_revenge_custom_bg_video_v1'
  }
};

// ==========================================
// 2. PROCEDURAL MEME SOUND & AUDIO SYNTHESIZER
// ==========================================
class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.isMuted = false;
    this.isBgmPlaying = false;
    this.bgmTimer = null;
    this.bgmStep = 0;

    // Custom audio files (put them in the /audio folder)
    this.files = {
      ball: this.loadFile('audio/ball-audio.mpeg', 0.9),
      result: this.loadFile('audio/result-audio.mpeg', 1.0)
    };
  }

  loadFile(src, volume) {
    try {
      const a = new Audio(src);
      a.preload = 'auto';
      a.volume = volume;
      a.addEventListener('error', () => { a.failed = true; });
      return a;
    } catch (e) {
      return null;
    }
  }

  // Plays a custom file; returns false if unavailable so callers can fall back.
  playFile(key) {
    const base = this.files[key];
    if (!base || base.failed) return false;
    try {
      // Clone so rapid flaps can overlap instead of cutting each other off
      const a = base.cloneNode();
      a.volume = base.volume;
      const p = a.play();
      if (p && p.catch) p.catch(() => { base.failed = true; });
      return true;
    } catch (e) {
      return false;
    }
  }

  // Result audio loops for as long as the game-over screen is showing.
  playResultSound() {
    const a = this.files.result;
    if (!a || a.failed) return;
    this.resultActive = true;
    a.loop = true;
    a.volume = 0.6;
    a.currentTime = 0;
    if (this.isMuted) return;
    const p = a.play();
    if (p && p.catch) p.catch(() => { a.failed = true; });
  }

  stopResultSound() {
    this.resultActive = false;
    const a = this.files.result;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playBoingJump() {
    if (this.isMuted) return;
    if (this.playFile('ball')) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(540, now + 0.12);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }

  playCoinDing() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      [880, 1320].forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.2, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.2);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.22);
      });
    } catch (e) {}
  }

  playPowerupChime() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      [330, 440, 550, 660, 880].forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0.12, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.15);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.18);
      });
    } catch (e) {}
  }

  // Heavy 808 Meme Sub-bass Drop (Vine Boom style)
  playVineBoom() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;

      // Heavy transient click
      const click = this.audioCtx.createOscillator();
      const clickGain = this.audioCtx.createGain();
      click.type = 'square';
      click.frequency.setValueAtTime(220, now);
      click.frequency.exponentialRampToValueAtTime(40, now + 0.08);
      clickGain.gain.setValueAtTime(0.4, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      click.connect(clickGain);
      clickGain.connect(this.audioCtx.destination);
      click.start(now);
      click.stop(now + 0.09);

      // Deep sub drop
      const sub = this.audioCtx.createOscillator();
      const subGain = this.audioCtx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(140, now);
      sub.frequency.exponentialRampToValueAtTime(28, now + 0.8);
      subGain.gain.setValueAtTime(0.65, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      sub.connect(subGain);
      subGain.connect(this.audioCtx.destination);
      sub.start(now);
      sub.stop(now + 0.9);
    } catch (e) {}
  }

  // Triumphant Airhorn Fanfare (for big combos or record breakers)
  playAirhorn() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const freqs = [466.16, 466.16, 466.16, 466.16];
      freqs.forEach((f, i) => {
        const start = now + i * 0.12;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, start);
        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.1);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(start);
        osc.stop(start + 0.11);
      });
    } catch (e) {}
  }

  // Firework pop: short low-passed noise burst
  playFireworkPop() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;
    try {
      const ac = this.audioCtx;
      const now = ac.currentTime;
      const len = Math.floor(ac.sampleRate * 0.35);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      const gain = ac.createGain();
      gain.gain.value = 0.3;
      src.connect(lp);
      lp.connect(gain);
      gain.connect(ac.destination);
      src.start(now);
    } catch (e) {}
  }

  // Procedural Synth Chiptune BGM groove
  startBgm() {
    if (this.isMuted || this.isBgmPlaying) return;
    this.init();
    if (!this.audioCtx) return;
    this.isBgmPlaying = true;
    this.bgmStep = 0;

    const bassNotes = [110, 110, 130.81, 146.83, 110, 110, 164.81, 146.83];
    const bpm = 125;
    const intervalMs = (60 / bpm / 2) * 1000;

    this.bgmTimer = setInterval(() => {
      if (this.isMuted || !this.isBgmPlaying) return;
      try {
        const now = this.audioCtx.currentTime;
        const note = bassNotes[this.bgmStep % bassNotes.length];

        // Bass synth
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(note, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.2);

        this.bgmStep++;
      } catch (e) {}
    }, intervalMs);
  }

  stopBgm() {
    this.isBgmPlaying = false;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopBgm();
      if (this.files.result) this.files.result.pause();
    } else if (this.resultActive && this.files.result && !this.files.result.failed) {
      this.files.result.play().catch(() => {});
    }
    return this.isMuted;
  }
}

// ==========================================
// 3. TEXT-TO-SPEECH VOICE ROASTER
// ==========================================
class VoiceRoaster {
  constructor() {
    this.enabled = true;
    this.synth = window.speechSynthesis || null;
  }

  roast(friendName, score) {
    // AI voice removed: the game no longer speaks.
    return;
    if (!this.enabled || !this.synth) return;

    try {
      this.synth.cancel(); // Cancel any ongoing speech

      let roastText = "";
      if (score === 0) {
        roastText = `Oh no, ${friendName} crashed instantly! Total zero!`;
      } else if (score < 4) {
        roastText = `${friendName}, bro choked at score ${score}! Absolute skill issue!`;
      } else if (score < 10) {
        roastText = `Emotional damage! ${friendName} couldn't even reach double digits!`;
      } else {
        roastText = `Not bad ${friendName}, but your aura is still negative!`;
      }

      const utterance = new SpeechSynthesisUtterance(roastText);
      utterance.pitch = 1.35; // slightly goofy high pitch
      utterance.rate = 1.15;  // fast comical delivery
      this.synth.speak(utterance);
    } catch (e) {
      console.warn("TTS error:", e);
          }
  }
}

// ==========================================
// 4. PRESET MEME AVATARS (SVG DATA URIS)
// ==========================================
const PRESET_FACES = [
  {
    id: 'wojak',
    name: 'Crying Bro',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="48" fill="#ffe0b2"/>
      <ellipse cx="36" cy="42" rx="7" ry="10" fill="#fff" stroke="#333" stroke-width="2"/>
      <ellipse cx="64" cy="42" rx="7" ry="10" fill="#fff" stroke="#333" stroke-width="2"/>
      <circle cx="36" cy="44" r="3.5" fill="#111"/>
      <circle cx="64" cy="44" r="3.5" fill="#111"/>
      <path d="M 28 32 Q 36 28 44 34" stroke="#444" stroke-width="3" fill="none"/>
      <path d="M 72 32 Q 64 28 56 34" stroke="#444" stroke-width="3" fill="none"/>
      <path d="M 34 68 Q 50 56 66 68" stroke="#d32f2f" stroke-width="4" fill="none"/>
      <!-- Big Tear Drops -->
      <path d="M 33 52 C 30 60 40 60 37 52 Z" fill="#00b0ff"/>
      <path d="M 65 52 C 62 60 72 60 69 52 Z" fill="#00b0ff"/>
    </svg>`
  },
  {
    id: 'derp',
    name: 'Giga Derp',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="48" fill="#ffcc80"/>
      <circle cx="32" cy="42" r="12" fill="#fff" stroke="#222" stroke-width="2.5"/>
      <circle cx="68" cy="40" r="8" fill="#fff" stroke="#222" stroke-width="2.5"/>
      <circle cx="34" cy="42" r="4" fill="#000"/>
      <circle cx="66" cy="40" r="2.5" fill="#000"/>
      <!-- Buck teeth -->
      <path d="M 32 64 Q 50 82 68 64" fill="#5c1d1d" stroke="#111" stroke-width="2"/>
      <rect x="44" y="65" width="6" height="8" fill="#fff" stroke="#222" stroke-width="1.5"/>
      <rect x="50" y="65" width="6" height="8" fill="#fff" stroke="#222" stroke-width="1.5"/>
      <ellipse cx="25" cy="54" rx="4" ry="2.5" fill="#ff8a80"/>
      <ellipse cx="75" cy="54" rx="4" ry="2.5" fill="#ff8a80"/>
    </svg>`
  },
  {
    id: 'clown',
    name: 'Full Clown',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#e0e0e0" stroke-width="2"/>
      <!-- Clown hair -->
      <circle cx="14" cy="40" r="14" fill="#e91e63"/>
      <circle cx="86" cy="40" r="14" fill="#e91e63"/>
      <circle cx="16" cy="60" r="12" fill="#ff9800"/>
      <circle cx="84" cy="60" r="12" fill="#ff9800"/>
      <!-- Red Nose -->
      <circle cx="50" cy="52" r="12" fill="#f44336"/>
      <!-- Blue diamond eye makeup -->
      <polygon points="36,26 42,40 36,54 30,40" fill="#2196f3"/>
      <polygon points="64,26 70,40 64,54 58,40" fill="#2196f3"/>
      <!-- Huge Smile -->
      <path d="M 28 66 Q 50 94 72 66" fill="#d32f2f" stroke="#b71c1c" stroke-width="2"/>
    </svg>`
  },
  {
    id: 'shocked',
    name: 'Bro Shocked',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="48" fill="#ffe57f"/>
      <circle cx="34" cy="38" r="9" fill="#fff" stroke="#222" stroke-width="2"/>
      <circle cx="66" cy="38" r="9" fill="#fff" stroke="#222" stroke-width="2"/>
      <circle cx="34" cy="38" r="3" fill="#000"/>
      <circle cx="66" cy="38" r="3" fill="#000"/>
      <!-- Huge O Mouth -->
      <ellipse cx="50" cy="68" rx="13" ry="17" fill="#212121"/>
      <ellipse cx="50" cy="74" rx="8" ry="8" fill="#e53935"/>
      <path d="M 26 25 L 42 30" stroke="#333" stroke-width="3" stroke-linecap="round"/>
      <path d="M 74 25 L 58 30" stroke="#333" stroke-width="3" stroke-linecap="round"/>
    </svg>`
  }
];

function svgToDataUrl(svgString) {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgString.trim());
}

// ==========================================
// 5. MAIN GAME LOGIC & ENGINE
// ==========================================
class RevengeGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.sound = new SoundEngine();
    this.voice = new VoiceRoaster();

    // State Variables
    this.state = 'MENU'; // 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'
    this.score = 0;
    this.bestScore = parseInt(localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.BEST_SCORE) || '0', 10);
    this.totalDeaths = parseInt(localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.TOTAL_DEATHS) || '0', 10);
    this.friendName = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.FRIEND_NAME) || 'Bro';
    this.currentProp = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.FRIEND_PROP) || '🤡';
    this.obstacleStyle = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.OBSTACLE_STYLE) || 'neon';
    this.voiceEnabled = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.VOICE_ENABLED) !== 'false';
    this.voice.enabled = this.voiceEnabled;

    // Viewport scaling
    this.scale = 1;
    this.virtualWidth = CONFIG.CANVAS_VIRTUAL_WIDTH;
    this.virtualHeight = CONFIG.CANVAS_VIRTUAL_HEIGHT;

    // Player Entity
    this.player = {
      x: 100,
      y: 300,
      vy: 0,
      rotation: 0,
      radius: CONFIG.BIRD_DEFAULT_RADIUS,
      baseRadius: CONFIG.BIRD_DEFAULT_RADIUS,
      scaleX: 1,
      scaleY: 1,
      isInvincible: false,
      invincibleTimer: 0,
      isGiant: false,
      giantTimer: 0,
      isSlowMo: false,
      slowMoTimer: 0
    };

    // Game Objects
    this.obstacles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.powerups = [];
    this.combo = 1;
    this.lastObstaclePassed = null;

    // Avatar image setup
    this.avatarImg = new Image();
    this.loadInitialAvatar();

    // Loop & timing


    this.lastTime = 0;
    this.animFrameId = null;

    // Keep delayed game-over actions cancellable when restarting or returning to menu.
    this.gameOverTimer = null;
    this.voiceRoastTimer = null;

    // Bind event listeners & init DOM
    this.initDOM();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Start render loop (animates menu preview)
    this.loop = this.loop.bind(this);
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  loadInitialAvatar() {
    const savedCustomAvatar = localStorage.getItem(
      CONFIG.LOCAL_STORAGE_KEYS.FRIEND_AVATAR
    );

    // Use the saved custom face when available; otherwise use the supplied bro photo.
    this.avatarImg.onload = () => {
      if (this.menuAvatarImg && this.roastAvatarImg) {
        this.updateDomLabels();
      }
    };

    this.avatarImg.onerror = () => {
      console.error(
        'Could not load the player avatar. Check that images/bro-ball.jpeg exists.'
      );
    };

    this.avatarImg.src = savedCustomAvatar || 'images/bro-ball.jpeg';
  }

  // ------------------------------------------
  // RESIZE & HIGH-DPI CANVAS MANAGEMENT
  // ------------------------------------------
  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);

    this.scale = (rect.width * dpr) / this.virtualWidth;
    this.virtualHeight = (rect.height * dpr) / this.scale;
  }

  // ------------------------------------------
  // CONTROLS & EVENT BINDINGS
  // ------------------------------------------
  initDOM() {
    // Menu elements
    this.menuScreen = document.getElementById('menuScreen');
    this.gameOverScreen = document.getElementById('gameOverScreen');
    this.customizerModal = document.getElementById('customizerModal');
    this.helpModal = document.getElementById('helpModal');
    this.webcamModal = document.getElementById('webcamModal');
    this.wastedOverlay = document.getElementById('wastedOverlay');
    this.tauntBanner = document.getElementById('tauntBanner');
    this.diwaliCelebration = document.getElementById('diwaliCelebration');
    this.resultLoopVideo = document.getElementById('resultLoopVideo');
    this.fwCanvas = document.getElementById('fireworksCanvas');
    this.fwCtx = this.fwCanvas ? this.fwCanvas.getContext('2d') : null;
    this.fw = null;

    // Score elements
    this.currentScoreEl = document.getElementById('currentScore');
    this.comboBadgeEl = document.getElementById('comboBadge');
    this.menuBestScoreEl = document.getElementById('menuBestScore');
    this.menuTotalDeathsEl = document.getElementById('menuTotalDeaths');
    this.friendLogoNameEl = document.getElementById('friendLogoName');

    // Avatar previews in DOM
    this.menuAvatarImg = document.getElementById('menuAvatarImg');
    this.menuAvatarProp = document.getElementById('menuAvatarProp');
    this.roastAvatarImg = document.getElementById('roastAvatarImg');

    this.updateDomLabels();

    // Play Buttons
    document.getElementById('btnPlayGame').addEventListener('click', () => this.startGame());
    document.getElementById('btnPlayAgain').addEventListener('click', () => this.startGame());
    document.getElementById('btnBackToMenu').addEventListener('click', () => this.showMenu());

    // Sound button
    const btnToggleSound = document.getElementById('btnToggleSound');
    btnToggleSound.addEventListener('click', () => {
      const muted = this.sound.toggleMute();
      if (!muted && this.state === 'PLAYING') this.sound.startBgm();
      document.getElementById('soundIcon').textContent = muted ? '🔇' : '🔊';
      document.getElementById('soundLabel').textContent = muted ? 'SFX OFF' : 'SFX ON';
    });

    // Pause button
    document.getElementById('btnPause').addEventListener('click', () => this.togglePause());

    // Modal Triggers
    const openCustomizer = () => {
      this.populateCustomizerInputs();
      if (this.state === 'PLAYING') this.togglePause();
      this.customizerModal.classList.remove('hidden');
    };
    document.getElementById('btnCustomizer').addEventListener('click', openCustomizer);
    document.getElementById('btnQuickCustom').addEventListener('click', openCustomizer);
    document.getElementById('menuAvatarTrigger').addEventListener('click', openCustomizer);
    document.getElementById('btnCloseModal').addEventListener('click', () => {
      this.customizerModal.classList.add('hidden');
    });

    document.getElementById('btnHowToPlay').addEventListener('click', () => {
      this.helpModal.classList.remove('hidden');
    });
    document.getElementById('btnCloseHelp').addEventListener('click', () => {
      this.helpModal.classList.add('hidden');
    });

    // Save Customizer
    document.getElementById('btnSaveCustomizer').addEventListener('click', () => {
      this.saveCustomizerSettings();
      this.customizerModal.classList.add('hidden');
    });

    // User Image Upload
    const faceFileInput = document.getElementById('faceFileInput');
    faceFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          this.downscaleImage(evt.target.result, 320).then((url) => this.setCustomAvatar(url));
        };
        reader.readAsDataURL(file);
      }
    });

    document.getElementById('btnResetFace').addEventListener('click', () => {
      localStorage.removeItem(CONFIG.LOCAL_STORAGE_KEYS.FRIEND_AVATAR);
      this.loadInitialAvatar();
      this.updateDomLabels();
    });

    // Video Background Input
    const bgVideoInput = document.getElementById('bgVideoInput');
    const customBgVideo = document.getElementById('customBgVideo');
    bgVideoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const url = URL.createObjectURL(file);
        customBgVideo.src = url;
        customBgVideo.classList.remove('hidden');
        customBgVideo.play().catch(() => {});
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.CUSTOM_BG_VIDEO, 'true');
      }
    });

    document.getElementById('btnRemoveVideoBg').addEventListener('click', () => {
      customBgVideo.pause();
      customBgVideo.removeAttribute('src');
      customBgVideo.load();
            customBgVideo.classList.add('hidden');
      localStorage.removeItem(CONFIG.LOCAL_STORAGE_KEYS.CUSTOM_BG_VIDEO);
    });

    // Webcam capture modal
    this.setupWebcamModal();

    // Share & Export Buttons
    document.getElementById('btnShareWhatsApp').addEventListener('click', () => this.shareOnWhatsApp());
    document.getElementById('btnSaveRoastImg').addEventListener('click', () => this.exportRoastCardImage());

    // Gameplay input triggers
    window.addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || this.isModalOpen()) {
        if (e.code === 'Escape') this.closeModals();
        return;
      }
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (!e.repeat) this.handleAction();
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        this.togglePause();
      }
      if (e.code === 'KeyM') {
        btnToggleSound.click();
      }
    });

    this.canvas.parentElement.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.hud-top') || e.target.closest('.screen-modal')) return;
      this.handleAction();
    });

    // Setup Preset Face Selection Buttons
    this.renderPresetFaceButtons();
    this.setupPropSelectors();
    this.setupObstacleSelectors();
  }

  updateDomLabels() {
    this.menuBestScoreEl.textContent = this.bestScore;
    this.menuTotalDeathsEl.textContent = this.totalDeaths;
    this.friendLogoNameEl.textContent = this.friendName.toUpperCase();
    this.menuAvatarImg.src = this.avatarImg.src;
    this.roastAvatarImg.src = this.avatarImg.src;
    this.menuAvatarProp.textContent = this.currentProp === 'none' ? '' : this.currentProp;
  }

  setCustomAvatar(dataUrl) {
    this.avatarImg.src = dataUrl;
    try {
      localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.FRIEND_AVATAR, dataUrl);
    } catch (err) {
      console.warn('Face is too large to save for next time, using it for this session only.', err);
    }
    this.updateDomLabels();
  }

  renderPresetFaceButtons() {
    const grid = document.getElementById('presetFacesGrid');
    grid.innerHTML = '';
    PRESET_FACES.forEach(preset => {
      const btn = document.createElement('div');
      btn.className = 'preset-face-btn';
      const img = document.createElement('img');
      img.src = svgToDataUrl(preset.svg);
      const span = document.createElement('span');
      span.textContent = preset.name;
      btn.appendChild(img);
      btn.appendChild(span);
      btn.addEventListener('click', () => {
        this.setCustomAvatar(svgToDataUrl(preset.svg));
        document.querySelectorAll('.preset-face-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      grid.appendChild(btn);
    });
  }

  setupPropSelectors() {
    const container = document.getElementById('propSelector');
    container.querySelectorAll('.prop-btn').forEach(btn => {
      if (btn.dataset.prop === this.currentProp) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      btn.addEventListener('click', () => {
        container.querySelectorAll('.prop-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentProp = btn.dataset.prop;
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.FRIEND_PROP, this.currentProp);
        this.updateDomLabels();
      });
    });
  }

  setupObstacleSelectors() {
    const container = document.getElementById('obstacleSelector');
    container.querySelectorAll('.theme-btn').forEach(btn => {
      if (btn.dataset.obstacle === this.obstacleStyle) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      btn.addEventListener('click', () => {
        container.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.obstacleStyle = btn.dataset.obstacle;
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.OBSTACLE_STYLE, this.obstacleStyle);
      });
    });
  }

  populateCustomizerInputs() {
    document.getElementById('inputFriendName').value = this.friendName;
    document.getElementById('checkVoiceRoaster').checked = this.voiceEnabled;
  }

  saveCustomizerSettings() {
    const nameVal = document.getElementById('inputFriendName').value.trim();
    if (nameVal) {
      this.friendName = nameVal;
      localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.FRIEND_NAME, this.friendName);
    }
    this.voiceEnabled = document.getElementById('checkVoiceRoaster').checked;
    this.voice.enabled = this.voiceEnabled;
    localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.VOICE_ENABLED, this.voiceEnabled);
    this.updateDomLabels();
  }

  // ------------------------------------------
  // WEBCAM SELFIE SNAP FEATURE
  // ------------------------------------------
  setupWebcamModal() {
    const btnWebcamSnap = document.getElementById('btnWebcamSnap');
    const btnCloseWebcam = document.getElementById('btnCloseWebcam');
    const webcamVideo = document.getElementById('webcamVideo');
    const btnCapturePhoto = document.getElementById('btnCapturePhoto');
    let stream = null;

    btnWebcamSnap.addEventListener('click', async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        webcamVideo.srcObject = stream;
        this.webcamModal.classList.remove('hidden');
      } catch (err) {
        alert('Could not access webcam. You can upload a photo instead!');
      }
    });

    const stopWebcam = () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      this.webcamModal.classList.add('hidden');
    };

    btnCloseWebcam.addEventListener('click', stopWebcam);

    btnCapturePhoto.addEventListener('click', () => {
      if (!stream) return;
      const offCanvas = document.createElement('canvas');
      offCanvas.width = 300;
      offCanvas.height = 300;
      const offCtx = offCanvas.getContext('2d');

      // Mirror capture
      offCtx.translate(300, 0);
      offCtx.scale(-1, 1);
      const vw = webcamVideo.videoWidth || 300;
      const vh = webcamVideo.videoHeight || 300;
      const side = Math.min(vw, vh);
      offCtx.drawImage(webcamVideo, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, 300, 300);

      const capturedUrl = offCanvas.toDataURL('image/jpeg', 0.9);
      this.setCustomAvatar(capturedUrl);
      stopWebcam();
    });
  }

  // ------------------------------------------
  // GAMEPLAY FLOW & STATES
  // ------------------------------------------
  handleAction() {
    if (this.state === 'MENU') {
      if (!this.isModalOpen()) this.startGame();
    } else if (this.state === 'PLAYING') {
      this.jump();
    } else if (this.state === 'PAUSED') {
      this.togglePause();
    } else if (this.state === 'GAME_OVER') {
      if (this.canRestart) {
        this.startGame();
      } else if (this.celebrating && performance.now() - this.crashTime > 1200) {
        this.skipCelebration();
      }
    }
  }

  startGame() {
    // Cancel any pending game-over presentation from the previous round.
    clearTimeout(this.gameOverTimer);
    clearTimeout(this.voiceRoastTimer);
    this.gameOverTimer = null;
    this.voiceRoastTimer = null;

    this.state = 'PLAYING';
    this.menuScreen.classList.add('hidden');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    this.gameOverScreen.classList.add('hidden');
    this.wastedOverlay.classList.remove('active');

    if (this.diwaliCelebration) {
      this.diwaliCelebration.classList.add('hidden');
      this.stopFireworks();
    }

    if (this.resultLoopVideo) {
      this.resultLoopVideo.pause();
      this.sound.stopResultSound();
      this.resultLoopVideo.currentTime = 0;
    }

    // Reset Player
    this.player.x = 110;
    this.player.y = this.virtualHeight * 0.45;
    this.player.vy = CONFIG.JUMP_FORCE;
    this.player.rotation = -0.3;
    this.player.radius = CONFIG.BIRD_DEFAULT_RADIUS;
    this.player.isInvincible = false;
    this.player.isGiant = false;
    this.player.isSlowMo = false;
    this.player.scaleX = 0.8;
    this.player.scaleY = 1.3;

    // Reset scores & obstacles
    this.score = 0;
    this.combo = 1;
    this.currentScoreEl.textContent = '0';
    this.comboBadgeEl.classList.remove('active');
    this.obstacles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.powerups = [];

    // Spawn first obstacle
    this.spawnObstacle(this.virtualWidth + 120);

    // Audio & BGM
    this.sound.playBoingJump();
    this.sound.startBgm();

    this.showTaunt("Don't embarrass yourself, " + this.friendName + "!");
  }

  showMenu() {
    clearTimeout(this.gameOverTimer);
    clearTimeout(this.voiceRoastTimer);
    this.gameOverTimer = null;
    this.voiceRoastTimer = null;

    this.state = 'MENU';
    this.sound.stopBgm();
    this.menuScreen.classList.remove('hidden');
    this.gameOverScreen.classList.add('hidden');
    this.wastedOverlay.classList.remove('active');

    if (this.diwaliCelebration) {
      this.diwaliCelebration.classList.add('hidden');
      this.stopFireworks();
    }

    if (this.resultLoopVideo) {
      this.resultLoopVideo.pause();
      this.sound.stopResultSound();
      this.resultLoopVideo.currentTime = 0;
    }

    this.updateDomLabels();
  }

  isModalOpen() {
    return [this.customizerModal, this.helpModal, this.webcamModal].some(
      (m) => m && !m.classList.contains('hidden')
    );
  }

  closeModals() {
    if (this.webcamModal && !this.webcamModal.classList.contains('hidden')) {
      document.getElementById('btnCloseWebcam').click();
      return;
    }
    this.customizerModal.classList.add('hidden');
    this.helpModal.classList.add('hidden');
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      document.getElementById('pauseIcon').textContent = '▶️';
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.lastTime = performance.now();
      document.getElementById('pauseIcon').textContent = '⏸️';
    }
  }

  jump() {
    this.player.vy = CONFIG.JUMP_FORCE;
    this.player.scaleX = 0.75;
    this.player.scaleY = 1.35;
    this.sound.playBoingJump();

    // Spawn comical flap particles
    const emoji = this.player.isInvincible ? '🔥' : '💨';
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x: this.player.x - 16,
        y: this.player.y + (Math.random() * 12 - 6),
        vx: -(Math.random() * 2 + 1),
        vy: Math.random() * 2 - 1,
        life: 1,
        decay: 0.05,
        emoji: emoji,
        size: 18
      });
    }
  }

  spawnObstacle(x) {
    const gap = Math.max(CONFIG.MIN_GAP, CONFIG.INITIAL_GAP - this.score * CONFIG.GAP_DECREMENT);
    const minHeight = 70;
    const availableHeight = this.virtualHeight - 90 - gap - (minHeight * 2);
    const topHeight = minHeight + Math.random() * Math.max(10, availableHeight);
        const bottomY = topHeight + gap;
    const bottomHeight = this.virtualHeight - 90 - bottomY;

    this.obstacles.push({
      x: x,
      width: CONFIG.PIPE_WIDTH,
      topHeight: topHeight,
      bottomY: bottomY,
      bottomHeight: bottomHeight,
      gap: gap,
      passed: false
    });

    // 25% chance to spawn a fun power-up in the middle of gap!
    if (Math.random() < 0.28) {
      const types = ['chai', 'pizza', 'shades', 'diamond'];
      const chosen = types[Math.floor(Math.random() * types.length)];
      this.powerups.push({
        x: x + CONFIG.PIPE_WIDTH / 2,
        y: topHeight + gap / 2,
        type: chosen,
        collected: false,
        pulseOffset: Math.random() * Math.PI
      });
    }
  }

  // ------------------------------------------
  // UPDATE LOOP (PHYSICS & COLLISIONS)
  // ------------------------------------------
  update(dt) {
    if (this.state !== 'PLAYING') return;

    // Time-dilation if Slow-Mo power-up is active
    const timeScale = this.player.isSlowMo ? 0.6 : 1.0;
    const effectiveDt = dt * timeScale;

    // Speed scales slightly with score
    const currentSpeed = Math.min(CONFIG.MAX_SPEED, CONFIG.BASE_SPEED + this.score * CONFIG.SPEED_INCREMENT) * timeScale;

    // Update Player Physics
    this.player.vy += CONFIG.GRAVITY * effectiveDt;
    if (this.player.vy > CONFIG.MAX_FALL_SPEED) this.player.vy = CONFIG.MAX_FALL_SPEED;
    this.player.y += this.player.vy * effectiveDt;

    // Target rotation based on velocity
    let targetRot = this.player.vy < 0 ? -0.4 : Math.min(this.player.vy / CONFIG.MAX_FALL_SPEED, 1) * 1.15;
    this.player.rotation += (targetRot - this.player.rotation) * 0.15;

    // Lerp squish & stretch back to normal
    this.player.scaleX += (1 - this.player.scaleX) * 0.12;
    this.player.scaleY += (1 - this.player.scaleY) * 0.12;

    // Handle Power-Up Timers
    if (this.player.isInvincible) {
      this.player.invincibleTimer -= effectiveDt;
      if (this.player.invincibleTimer <= 0) this.player.isInvincible = false;
    }
    if (this.player.isGiant) {
      this.player.giantTimer -= effectiveDt;
      this.player.radius = CONFIG.BIRD_DEFAULT_RADIUS * 1.6;
      if (this.player.giantTimer <= 0) {
        this.player.isGiant = false;
        this.player.radius = CONFIG.BIRD_DEFAULT_RADIUS;
      }
    }
    if (this.player.isSlowMo) {
      this.player.slowMoTimer -= effectiveDt;
      if (this.player.slowMoTimer <= 0) this.player.isSlowMo = false;
    }

    // Floor and Ceiling Collision Check
    const floorLimit = this.virtualHeight - 90;
    if (this.player.y - this.player.radius <= 0) {
      this.player.y = this.player.radius;
      this.player.vy = 0;
    }
    if (this.player.y + this.player.radius >= floorLimit) {
      this.triggerGameOver("bro fell on his face");
      return;
    }

    // Update Obstacles & Collision Check
    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      obs.x -= currentSpeed * effectiveDt;

      // Score passing
      if (!obs.passed && obs.x + obs.width < this.player.x) {
        obs.passed = true;
        this.addScore();
      }

      // Check collision if not invincible
      if (!this.player.isInvincible) {
        if (this.checkPipeCollision(this.player, obs)) {
          this.triggerGameOver("collision");
          return;
        }
      }
    }

    // Remove passed obstacles and spawn new ones
    this.obstacles = this.obstacles.filter(o => o.x + o.width > -50);
    const lastObs = this.obstacles[this.obstacles.length - 1];
    if (lastObs && lastObs.x <= this.virtualWidth) {
      this.spawnObstacle(lastObs.x + CONFIG.PIPE_SPAWN_DIST);
    }

    // Update Powerups
    for (let i = 0; i < this.powerups.length; i++) {
      const pu = this.powerups[i];
      pu.x -= currentSpeed * effectiveDt;

      // Check collect collision
      if (!pu.collected) {
        const dx = this.player.x - pu.x;
        const dy = this.player.y - pu.y;
        if (dx * dx + dy * dy < (this.player.radius + 18) * (this.player.radius + 18)) {
          pu.collected = true;
          this.collectPowerup(pu);
        }
      }
    }
    this.powerups = this.powerups.filter(p => p.x > -60 && !p.collected);

    // Update Particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    // Update Floating Texts
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.life -= ft.decay;
    }
    this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);
  }

  updateEffects(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.12 * dt;
      p.life -= p.decay * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const ft of this.floatingTexts) {
      ft.y += ft.vy * dt;
      ft.life -= ft.decay * dt;
    }
    this.floatingTexts = this.floatingTexts.filter((ft) => ft.life > 0);
  }

  downscaleImage(src, size) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(img.width, img.height);
        const c = document.createElement('canvas');
        c.width = c.height = size;
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) * 0.3, s, s, 0, 0, size, size);
        resolve(c.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  }

  skipCelebration() {
    clearTimeout(this.gameOverTimer);
    clearTimeout(this.voiceRoastTimer);
    if (this.diwaliCelebration) this.diwaliCelebration.classList.add('hidden');
    this.stopFireworks();
    this.displayRoastCard(this.lastIsNewBest);
    this.voiceRoastTimer = setTimeout(() => {
      if (this.state === 'GAME_OVER') this.voice.roast(this.friendName, this.score);
    }, 1700);
  }

  // ------------------------------------------
  // DIWALI CANVAS FIREWORKS
  // ------------------------------------------
  startFireworks() {
    const c = this.fwCanvas;
    if (!c || !this.fwCtx) return;
    const rect = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(1, Math.round(rect.width * dpr));
    c.height = Math.max(1, Math.round(rect.height * dpr));
    this.fw = { active: true, w: rect.width, h: rect.height, dpr, rockets: [], sparks: [], timer: 0 };
    this.launchRocket(true);
    this.launchRocket();
    this.launchRocket(true);
  }

  stopFireworks() {
    if (this.fw) this.fw.active = false;
    if (this.fwCtx && this.fwCanvas) this.fwCtx.clearRect(0, 0, this.fwCanvas.width, this.fwCanvas.height);
  }

  launchRocket(withFace = false) {
    const fw = this.fw;
    if (!fw) return;
    const colors = ['#ffb52e', '#ff5b18', '#ec4899', '#38bdf8', '#facc15', '#a3e635', '#ffffff'];
    fw.rockets.push({
      x: fw.w * (0.12 + Math.random() * 0.76),
      y: fw.h + (withFace ? 40 : 0),
      vx: (Math.random() - 0.5) * (withFace ? 1.6 : 1.2),
      vy: -Math.sqrt(2 * 0.12 * fw.h * (withFace ? 0.55 + Math.random() * 0.25 : 0.45 + Math.random() * 0.25)),
      color: colors[Math.floor(Math.random() * colors.length)],
      face: withFace,
      wobble: Math.random() * Math.PI * 2
    });
  }

  explodeRocket(r) {
    const fw = this.fw;
    const ring = Math.random() < 0.35;
    const n = r.face ? 110 : 64;
    for (let i = 0; i < n && fw.sparks.length < 900; i++) {
      const a = (i / n) * Math.PI * 2;
      const speed = ring ? 3.6 : 1.2 + Math.random() * 3.8;
      fw.sparks.push({
        x: r.x,
        y: r.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 1,
        decay: 0.012 + Math.random() * 0.01,
        color: i % 3 === 0 ? '#fff7ad' : r.color,
        size: 2.2
      });
    }
    this.sound.playFireworkPop();
  }

  updateFireworks(dt) {
    const fw = this.fw;
    if (!fw || !fw.active || !this.fwCtx) return;
    const ctx = this.fwCtx;

    fw.timer -= dt;
    if (fw.timer <= 0) {
      this.launchRocket(Math.random() < 0.55);
      fw.timer = 14 + Math.random() * 14;
    }

    for (let i = fw.rockets.length - 1; i >= 0; i--) {
      const r = fw.rockets[i];
      r.vy += 0.12 * dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      const tailY = r.face ? r.y + 36 : r.y;
      fw.sparks.push({ x: r.x, y: tailY, vx: (Math.random() - 0.5) * 0.8, vy: Math.random() * 1.2, life: r.face ? 0.8 : 0.5, decay: 0.05, color: r.face ? (Math.random() < 0.5 ? '#ff7a18' : '#ffd27a') : '#ffd27a', size: r.face ? 3.2 : 2 });
      if (r.vy >= -0.8) {
        this.explodeRocket(r);
        fw.rockets.splice(i, 1);
      }
    }

    for (let i = fw.sparks.length - 1; i >= 0; i--) {
      const s = fw.sparks[i];
      s.vx *= 0.985;
      s.vy = s.vy * 0.985 + 0.06 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= s.decay * dt;
      if (s.life <= 0) fw.sparks.splice(i, 1);
    }

    ctx.setTransform(fw.dpr, 0, 0, fw.dpr, 0, 0);
    ctx.clearRect(0, 0, fw.w, fw.h);
    ctx.globalCompositeOperation = 'lighter';
    for (const s of fw.sparks) {
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    for (const r of fw.rockets) {
      if (r.face) continue;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Rocket crackers carrying his face
    for (const r of fw.rockets) {
      if (r.face) this.drawFaceRocket(ctx, r, fw);
    }
  }

  drawFaceRocket(ctx, r, fw) {
    const R = 24; // face radius
    const t = performance.now() / 1000;
    const tilt = Math.atan2(r.vx, -r.vy) + Math.sin(t * 9 + r.wobble) * 0.12;

    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(tilt);

    // Fins
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(-9, 40); ctx.lineTo(-20, 56); ctx.lineTo(-4, 46); ctx.closePath();
    ctx.moveTo(9, 40); ctx.lineTo(20, 56); ctx.lineTo(4, 46); ctx.closePath();
    ctx.fill();

    // Cracker tube
    const grad = ctx.createLinearGradient(-9, 0, 9, 0);
    grad.addColorStop(0, '#b91c1c');
    grad.addColorStop(0.5, '#f97316');
    grad.addColorStop(1, '#b91c1c');
    ctx.fillStyle = grad;
    ctx.fillRect(-9, R - 6, 18, 36);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(-9, R + 6, 18, 4);

    // Flame
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-6, R + 30);
    ctx.lineTo(0, R + 30 + 16 + Math.random() * 12);
    ctx.lineTo(6, R + 30);
    ctx.closePath();
    ctx.fill();

    // Face (circular, white ring + glow)
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, R + 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.clip();
    const img = this.avatarImg;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.rotate(-tilt); // keep the face upright
      ctx.drawImage(img, -R, -R, R * 2, R * 2);
    } else {
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-R, -R, R * 2, R * 2);
      ctx.font = '30px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🤡', 0, 2);
    }
    ctx.restore();

    ctx.restore();
  }

  checkPipeCollision(player, obs) {
    // Top pipe bounding box
    if (this.circleRectCollision(player.x, player.y, player.radius * 0.9, obs.x, 0, obs.width, obs.topHeight)) {
      return true;
    }
    // Bottom pipe bounding box
    if (this.circleRectCollision(player.x, player.y, player.radius * 0.9, obs.x, obs.bottomY, obs.width, obs.bottomHeight)) {
      return true;
    }
    return false;
  }

  circleRectCollision(cx, cy, r, rx, ry, rw, rh) {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const distanceX = cx - closestX;
    const distanceY = cy - closestY;
    return (distanceX * distanceX + distanceY * distanceY) < (r * r);
  }

  addScore() {
    this.score++;
    this.currentScoreEl.textContent = this.score;

    // Check combos
    if (this.score % 5 === 0) {
      this.combo++;
      this.comboBadgeEl.textContent = `x${this.combo}`;
      this.comboBadgeEl.classList.add('active');
      this.sound.playAirhorn();
      this.showTaunt(`🔥 COMBO x${this.combo}! ${this.friendName} is sweating!`);
    } else {
      this.sound.playCoinDing();
    }

    // Pop funny floating text
    const roasts = ["+1 SKILL", "+1 LUCK", "EZ", "SHEESH", "KEEP CRYING", "NICE FLAP", "HE'S COOKING"];
    const chosenRoast = roasts[Math.floor(Math.random() * roasts.length)];
    this.floatingTexts.push({
      x: this.player.x + 30,
      y: this.player.y - 10,
      text: chosenRoast,
      color: '#facc15',
      vy: -1.4,
      life: 1,
      decay: 0.025
    });

    // Milestone Taunts
    if (this.score === 1) {
      this.showTaunt("Miracle! He passed 1 pipe!");
    } else if (this.score === 10) {
      this.showTaunt("Double digits?! Call Guinness Records!");
    } else if (this.score === 20) {
      this.showTaunt("Bro is beating the allegations!");
    }
  }

  collectPowerup(pu) {
    this.sound.playPowerupChime();
    let text = "";
    let color = "#38bdf8";

    if (pu.type === 'chai') {
      this.player.isInvincible = true;
      this.player.invincibleTimer = 300; // ~5 seconds
      text = "🚀 CHAI RUSH! INVINCIBLE!";
      color = "#f97316";
    } else if (pu.type === 'pizza') {
      this.player.isGiant = true;
      this.player.giantTimer = 350;
      text = "🍕 CHUBBY BRO! +2 PTS!";
      color = "#eab308";
      this.score += 2;
      this.currentScoreEl.textContent = this.score;
    } else if (pu.type === 'shades') {
      this.player.isSlowMo = true;
      this.player.slowMoTimer = 250;
      text = "🕶️ MATRIX MODE!";
      color = "#a855f7";
    } else if (pu.type === 'diamond') {
      this.score += 3;
      this.currentScoreEl.textContent = this.score;
      text = "💎 +3 MEME GEMS!";
      color = "#06b6d4";
    }

    this.floatingTexts.push({
      x: this.player.x,
      y: this.player.y - 30,
      text: text,
      color: color,
      vy: -1.6,
      life: 1.2,
      decay: 0.02
    });
  }

  showTaunt(message) {
    const banner = this.tauntBanner;
    document.getElementById('tauntText').textContent = message;
    banner.classList.add('show');
    clearTimeout(this.tauntTimer);
    this.tauntTimer = setTimeout(() => {
      banner.classList.remove('show');
    }, 2800);
  }

  // ------------------------------------------
  // GAME OVER & ROAST ENGINE
  // ------------------------------------------
  triggerGameOver(reason) {
    if (this.state === 'GAME_OVER') return;

    clearTimeout(this.gameOverTimer);
    clearTimeout(this.voiceRoastTimer);

    this.state = 'GAME_OVER';
    this.canRestart = false;
    this.celebrating = false;
    this.crashTime = performance.now();
    this.totalDeaths++;
    localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.TOTAL_DEATHS, this.totalDeaths);

    // Audio & Screen Effects
    this.sound.stopBgm();
    this.sound.playVineBoom();

    // Screen shake
    document.getElementById('gameWrapper').classList.add('screen-shake');
    setTimeout(() => {
      document.getElementById('gameWrapper').classList.remove('screen-shake');
    }, 400);

    // Wasted Red Flash
    this.wastedOverlay.classList.add('active');

    // Explode player into meme particles
    const deathEmojis = ['💀', '😭', '💸', '🤡', '💩', '💥'];
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x: this.player.x,
        y: this.player.y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1,
        decay: 0.02,
        emoji: deathEmojis[Math.floor(Math.random() * deathEmojis.length)],
        size: 24
      });
    }

    // Best Score check
    let isNewBest = false;
    this.lastIsNewBest = false;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.BEST_SCORE, this.bestScore);
      isNewBest = true;
      this.lastIsNewBest = true;
    }
        // Any crash (pipe or ground) triggers the Diwali celebration.
    const showDiwaliCelebration = Boolean(this.diwaliCelebration);

    if (showDiwaliCelebration) {
      this.diwaliCelebration.classList.remove('hidden');
      this.celebrating = true;
      this.startFireworks();
    }

    const resultDelay = showDiwaliCelebration ? 4200 : 700;
    const voiceDelay = resultDelay + 1700; // after result-audio.mpeg (~1.5s)

    // Speak only if the player has not restarted or returned to the menu.
    this.voiceRoastTimer = setTimeout(() => {
      if (this.state === 'GAME_OVER') {
        this.voice.roast(this.friendName, this.score);
      }
    }, voiceDelay);

    // Show the result card after the celebration (or immediately after a floor crash).
    this.gameOverTimer = setTimeout(() => {
      if (this.state !== 'GAME_OVER') return;

      if (this.diwaliCelebration) {
        this.diwaliCelebration.classList.add('hidden');
      this.stopFireworks();
      }

      this.displayRoastCard(isNewBest);
    }, resultDelay);
  }

  displayRoastCard(isNewBest) {
    document.getElementById('goScore').textContent = this.score;
    document.getElementById('goBest').textContent = this.bestScore;

    const rankBadge = document.getElementById('roastRankBadge');
    const titleEl = document.getElementById('goTitle');
    const quoteEl = document.getElementById('goRoastQuote');
    const stampEl = document.getElementById('roastStamp');

    const name = this.friendName;

    if (this.score === 0) {
      rankBadge.textContent = "🤡 ZERO AURA CLOWN";
      titleEl.textContent = `${name.toUpperCase()} CRASHED INSTANTLY!`;
      quoteEl.textContent = `"${name} couldn't even make it past pipe zero. Delete the game bro."`;
      stampEl.textContent = "ABSOLUTE NOOB";
    } else if (this.score < 5) {
      rankBadge.textContent = "🥔 POTATO TIER";
      titleEl.textContent = `${name.toUpperCase()} CHOKED HARD!`;
      quoteEl.textContent = `"Even a smart microwave has better gaming reflexes than ${name}."`;
      stampEl.textContent = "SKILL ISSUE";
    } else if (this.score < 12) {
      rankBadge.textContent = "📉 CERTIFIED DISAPPOINTMENT";
      titleEl.textContent = `${name.toUpperCase()} HIT THE WALL!`;
      quoteEl.textContent = `"${name} was celebrating at 5 points and immediately face-planted."`;
      stampEl.textContent = "MID AT BEST";
    } else if (this.score < 25) {
      rankBadge.textContent = "🥈 SWEATY TRYHARD";
      titleEl.textContent = `RESPECT EARNED... ALMOST!`;
      quoteEl.textContent = `"${name} was locking in with 100% focus and still got cooked."`;
      stampEl.textContent = "SWEATY BRO";
    } else {
      rankBadge.textContent = "👑 CHEATER DETECTED";
      titleEl.textContent = `${name.toUpperCase()} WENT GOD MODE!`;
      quoteEl.textContent = `"${name} actually popped off. He's still a clown though."`;
      stampEl.textContent = "LUCKY CHAD";
    }

    this.gameOverScreen.classList.remove('hidden');
    this.celebrating = false;
    this.sound.playResultSound();
    clearTimeout(this.restartLockTimer);
    this.restartLockTimer = setTimeout(() => { this.canRestart = true; }, 450);
    if (isNewBest && this.score > 0) {
      rankBadge.textContent += ' · NEW BEST!';
      this.sound.playAirhorn();
    }

    if (this.resultLoopVideo) {
      const vid = this.resultLoopVideo;
      vid.currentTime = 0;
      vid.muted = this.sound.isMuted;
      vid.play().catch(() => {
        vid.muted = true;
        vid.play().catch((error) => console.warn('Result video playback failed:', error));
      });
    }

    this.updateDomLabels();
  }

  // ------------------------------------------
  // WHATSAPP SHARE & ROAST EXPORT
  // ------------------------------------------
  shareOnWhatsApp() {
    const text = `🚨 *ATTENTION EVERYONE* 🚨%0A%0A` +
      `My friend *${this.friendName}* just got brutally roasted in *Bro's Downfall*! 🤡%0A` +
      `💀 Score: *${this.score}*%0A` +
      `🏆 Best: *${this.bestScore}*%0A` +
      `🗣️ Official Verdict: "${document.getElementById('goRoastQuote').textContent.replace(/"/g, '')}"%0A%0A` +
      `Can anyone beat this clown's score? 😂`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${text}`;
    window.open(whatsappUrl, '_blank');
  }

  exportRoastCardImage() {
    // Generate a downloadable image certificate from offscreen canvas
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 420;
    const ctx = c.getContext('2d');

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 600, 420);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 600, 420);

    // Border
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 580, 400);

    // Header
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 22px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ OFFICIAL CERTIFICATE OF DEFEAT ⚡', 300, 50);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 32px Fredoka, sans-serif';
    ctx.fillText(`${this.friendName.toUpperCase()} GOT COOKED!`, 300, 95);

    // Draw avatar in circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(140, 220, 70, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    try {
      ctx.drawImage(this.avatarImg, 70, 150, 140, 140);
    } catch (e) {}
    ctx.restore();

    // Red ring around avatar
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(140, 220, 70, 0, Math.PI * 2);
    ctx.stroke();

    // Stats
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    ctx.fillText('FINAL SCORE:', 250, 175);
    ctx.fillText('HIGH RECORD:', 250, 215);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "JetBrains Mono", monospace';
    ctx.fillText(`${this.score}`, 380, 175);
    ctx.fillText(`${this.bestScore}`, 380, 215);

    // Roast Quote
    ctx.fillStyle = '#f87171';
    ctx.font = 'italic 16px Outfit, sans-serif';
    const quote = document.getElementById('goRoastQuote').textContent;
    ctx.fillText(quote.length > 40 ? quote.substring(0, 40) + '...' : quote, 250, 265);

    // Stamp
    ctx.save();
    ctx.translate(460, 320);
    ctx.rotate(-0.15);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-80, -22, 160, 44);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 18px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(document.getElementById('roastStamp').textContent, 0, 7);
    ctx.restore();

    // Download as PNG
    const link = document.createElement('a');
    link.download = `${this.friendName}_roast_card.png`;
    link.href = c.toDataURL('image/png');
    link.click();
  }

  // ------------------------------------------
  // RENDERING ENGINE
  // ------------------------------------------
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.scale(this.scale, this.scale);

    // If in menu state, hover the player gently
    if (this.state === 'MENU') {
      const time = performance.now() * 0.004;
      this.player.y = this.virtualHeight * 0.45 + Math.sin(time) * 12;
      this.player.rotation = Math.sin(time) * 0.08;
    }

    // 1. Render Obstacles
    this.renderObstacles(ctx);

    // 2. Render Powerups
    this.renderPowerups(ctx);

    // 3. Render Particles
    this.renderParticles(ctx);

    // 4. Render Player Head / Friend Face
    this.renderPlayer(ctx);

    // 5. Render Floating Texts
    this.renderFloatingTexts(ctx);

    // 6. Render Ground / Floor
    this.renderGround(ctx);
    this.renderPausedBanner(ctx);

    ctx.restore();
  }

  renderObstacles(ctx) {
    const style = this.obstacleStyle;

    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];

      if (style === 'neon') {
        // High-tech Cyber Neon Pillars
        this.drawNeonPipe(ctx, obs.x, 0, obs.width, obs.topHeight, true);
        this.drawNeonPipe(ctx, obs.x, obs.bottomY, obs.width, obs.bottomHeight, false);
      } else if (style === 'chappal') {
        // Flying Chappal / Mom's Slipper Columns
        this.drawChappalPipe(ctx, obs.x, 0, obs.width, obs.topHeight, true);
        this.drawChappalPipe(ctx, obs.x, obs.bottomY, obs.width, obs.bottomHeight, false);
      } else if (style === 'exam') {
        // Exam paper stacks with red F
        this.drawExamPipe(ctx, obs.x, 0, obs.width, obs.topHeight, true);
        this.drawExamPipe(ctx, obs.x, obs.bottomY, obs.width, obs.bottomHeight, false);
      } else {
        // Toxic Pipes
        this.drawToxicPipe(ctx, obs.x, 0, obs.width, obs.topHeight, true);
        this.drawToxicPipe(ctx, obs.x, obs.bottomY, obs.width, obs.bottomHeight, false);
      }
    }
  }

  drawNeonPipe(ctx, x, y, width, height, isTop) {
    if (height <= 0) return;
    ctx.save();

    // Body gradient
    const grad = ctx.createLinearGradient(x, 0, x + width, 0);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.3, '#1e293b');
    grad.addColorStop(0.5, '#334155');
    grad.addColorStop(1, '#090d16');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, height);

    // Glowing core strip
    ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.fillRect(x + width / 2 - 3, y, 6, height);

    // Border
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Lip / Cap at the end
    const capHeight = 24;
    const capY = isTop ? y + height - capHeight : y;
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(x - 4, capY, width + 8, capHeight);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x - 4, capY, width + 8, capHeight);

    ctx.restore();
  }

  drawChappalPipe(ctx, x, y, width, height, isTop) {
    if (height <= 0) return;
    ctx.save();
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(x, y, width, height);

    // Pattern of slippers
    const capHeight = 26;
    const capY = isTop ? y + height - capHeight : y;
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(x - 4, capY, width + 8, capHeight);

    // Slipper Icon at tip
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🩴', x + width / 2, isTop ? y + height - 5 : y + 22);
    ctx.restore();
  }

  drawExamPipe(ctx, x, y, width, height, isTop) {
    if (height <= 0) return;
    ctx.save();
        ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(x, y, width, height);

    // Ruled lines
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    for (let ly = y + 15; ly < y + height; ly += 18) {
      ctx.beginPath();
      ctx.moveTo(x + 5, ly);
      ctx.lineTo(x + width - 5, ly);
      ctx.stroke();
    }

    // Red F Stamp
    ctx.fillStyle = '#dc2626';
    ctx.font = '900 24px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('F', x + width / 2, isTop ? y + height - 8 : y + 26);
    ctx.restore();
  }

  drawToxicPipe(ctx, x, y, width, height, isTop) {
    if (height <= 0) return;
    ctx.save();
    const grad = ctx.createLinearGradient(x, 0, x + width, 0);
    grad.addColorStop(0, '#14532d');
    grad.addColorStop(0.5, '#22c55e');
    grad.addColorStop(1, '#052e16');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  }

  renderPowerups(ctx) {
    const time = performance.now() * 0.005;
    for (let i = 0; i < this.powerups.length; i++) {
      const pu = this.powerups[i];
      const hoverY = pu.y + Math.sin(time + pu.pulseOffset) * 6;

      ctx.save();
      ctx.translate(pu.x, hoverY);

      // Glowing orb
      const radGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 20);
      radGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      radGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.5)');
      radGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();

      // Emoji Icon
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let icon = '☕';
      if (pu.type === 'pizza') icon = '🍕';
      if (pu.type === 'shades') icon = '🕶️';
      if (pu.type === 'diamond') icon = '💎';
      ctx.fillText(icon, 0, 0);

      ctx.restore();
    }
  }

  renderPlayer(ctx) {
    const p = this.player;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.scale(p.scaleX, p.scaleY);

    const r = p.radius;

    // Invincible Rocket Flames
    if (p.isInvincible) {
      ctx.save();
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.4);
      ctx.lineTo(-r - 28 - Math.random() * 12, 0);
      ctx.lineTo(-r, r * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Circular Clip for Friend's Photo
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Draw Face Image
    try {
      ctx.drawImage(this.avatarImg, -r, -r, r * 2, r * 2);
    } catch (e) {
      ctx.fillStyle = '#ffb74d';
      ctx.fill();
    }
    ctx.restore();

    // Glowing border around head
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = p.isInvincible ? '#f97316' : '#38bdf8';
    ctx.stroke();

    // Draw Selected Funny Prop / Hat on Head
    if (this.currentProp && this.currentProp !== 'none') {
      ctx.save();
      ctx.font = `${Math.round(r * 1.35)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.currentProp, 0, -r * 0.85);
      ctx.restore();
    }

    // Name Tag Above Head
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.roundRect(-40, -r - 26, 80, 18, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.friendName, 0, -r - 17);
    ctx.restore();

    ctx.restore();
  }

  renderParticles(ctx) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.font = `${p.size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, p.x, p.y);
      ctx.restore();
    }
  }

  renderFloatingTexts(ctx) {
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const ft = this.floatingTexts[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.life);
      ctx.fillStyle = ft.color;
      ctx.font = '900 16px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  renderPausedBanner(ctx) {
    if (this.state !== 'PAUSED') return;
    ctx.save();
    ctx.fillStyle = 'rgba(6, 9, 20, 0.55)';
    ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 40px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', this.virtualWidth / 2, this.virtualHeight / 2);
    ctx.font = '700 14px Outfit, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Tap or press P to resume', this.virtualWidth / 2, this.virtualHeight / 2 + 30);
    ctx.restore();
  }

  renderGround(ctx) {
    const floorY = this.virtualHeight - 90;
    const height = 90;

    ctx.save();

    // Ground base
    const grad = ctx.createLinearGradient(0, floorY, 0, floorY + height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, floorY, this.virtualWidth, height);

    // Cyber Grass / Glowing Edge
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, floorY, this.virtualWidth, 4);

    // Hazard caution stripes
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    for (let x = 0; x < this.virtualWidth; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, floorY + 4);
      ctx.lineTo(x + 16, floorY + 4);
      ctx.lineTo(x + 8, floorY + 24);
      ctx.lineTo(x - 8, floorY + 24);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  // ------------------------------------------
  // MAIN LOOP
  // ------------------------------------------
  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const elapsed = timestamp - this.lastTime;
    this.lastTime = timestamp;

    // Normalizing dt to ~1.0 for 60fps
    const dt = Math.min(Math.max(elapsed / 16.666, 0.5), 2.5);

    if (this.state === 'PLAYING') {
      this.update(dt);
    } else if (this.state !== 'PAUSED') {
      this.updateEffects(dt);
    }
    this.updateFireworks(dt);

    this.render();
    this.animFrameId = requestAnimationFrame(this.loop);
  }
}

// Instantiate and start once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.gameInstance = new RevengeGame();
});