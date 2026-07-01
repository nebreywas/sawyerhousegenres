/**
 * Shared footer HLS player — queue, seek, volume, repeat, cross-page persistence.
 * Playlist JSON lives in #site-playlist; paths are relative to site root (data-site-base).
 */
(function () {
  // Song Pages desktop client provides its own player — skip site footer player.
  // Also read ?songpagesApp=1 directly so older compiled HTML without site-app-mode.js still works.
  try {
    var params = new URLSearchParams(location.search);
    if (params.get("songpagesApp") === "1" || params.get("songpagesEmbed") === "1") {
      document.documentElement.classList.add("songpages-app-client");
    }
  } catch (e) {
    /* ignore */
  }
  if (document.documentElement.classList.contains("songpages-app-client")) {
    return;
  }

  const STORAGE_KEY = "artist-site-player-v1";

  const footer = document.getElementById("site-player-footer");
  const audio = document.getElementById("footer-audio");
  const playBtn = document.getElementById("footer-play-btn");
  const playIcon = playBtn?.querySelector(".icon-play");
  const pauseIcon = playBtn?.querySelector(".icon-pause");
  const titleEl = document.getElementById("footer-track-title");
  const scrub = document.getElementById("footer-scrub");
  const scrubFill = document.getElementById("footer-scrub-fill");
  const timeEl = document.getElementById("footer-time");
  const repeatBtn = document.getElementById("footer-repeat-btn");
  const muteBtn = document.getElementById("footer-mute-btn");
  const volumeIcon = muteBtn?.querySelector(".icon-volume");
  const muteIcon = muteBtn?.querySelector(".icon-mute");
  const volumeSlider = document.getElementById("footer-volume");

  if (!footer || !audio || !playBtn) return;

  let hlsInstance = null;
  let playlist = [];
  let queueIndex = 0;
  /** @type {"off" | "one" | "all"} */
  let repeatMode = "off";
  let isSeeking = false;

  const siteBase = document.body.getAttribute("data-site-base") || "./";

  const readPlaylist = () => {
    const el = document.getElementById("site-playlist");
    if (!el) return [];
    try {
      return JSON.parse(el.textContent || "[]");
    } catch {
      return [];
    }
  };

  const resolveUrl = (relativePath) => new URL(relativePath, new URL(siteBase, location.href)).href;

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const whole = Math.floor(seconds);
    const mins = Math.floor(whole / 60);
    const secs = whole % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const saveState = () => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          queueIndex,
          currentTime: audio.currentTime || 0,
          isPlaying: !audio.paused,
          repeatMode,
          volume: audio.volume,
          muted: audio.muted,
        }),
      );
    } catch {
      /* quota / private mode */
    }
  };

  const loadState = () => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const setPlayIcon = (playing) => {
    if (playIcon) playIcon.hidden = playing;
    if (pauseIcon) pauseIcon.hidden = !playing;
    playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
  };

  const updateTitleScroll = () => {
    if (!titleEl) return;
    titleEl.classList.remove("is-scrolling");
    titleEl.style.removeProperty("--scroll-distance");
    titleEl.style.removeProperty("--scroll-duration");

    requestAnimationFrame(() => {
      const wrap = titleEl.parentElement;
      if (!wrap || titleEl.scrollWidth <= wrap.clientWidth + 2) return;
      const distance = titleEl.scrollWidth - wrap.clientWidth + 8;
      titleEl.style.setProperty("--scroll-distance", `${distance}px`);
      titleEl.style.setProperty("--scroll-duration", `${Math.max(8, distance / 24)}s`);
      if (!audio.paused) titleEl.classList.add("is-scrolling");
    });
  };

  const updateScrub = () => {
    if (isSeeking) return;
    const duration = audio.duration || 0;
    const current = audio.currentTime || 0;
    const pct = duration > 0 ? (current / duration) * 100 : 0;
    if (scrubFill) scrubFill.style.width = `${pct}%`;
    if (scrub) scrub.setAttribute("aria-valuenow", String(Math.round(pct)));
    if (timeEl) timeEl.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  };

  const destroyHls = () => {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
  };

  const showFooter = () => footer.classList.remove("hidden");

  const applyRepeatUi = () => {
    if (!repeatBtn) return;
    repeatBtn.classList.toggle("is-active", repeatMode !== "off");
    repeatBtn.setAttribute("aria-pressed", repeatMode !== "off" ? "true" : "false");
    repeatBtn.setAttribute(
      "aria-label",
      repeatMode === "one" ? "Repeat one" : repeatMode === "all" ? "Repeat all" : "Repeat off",
    );
    const svg = repeatBtn.querySelector("svg");
    if (svg && repeatMode === "one") {
      svg.innerHTML =
        '<path d="m1096.8 434.4c-40.801 0-73.199 32.398-73.199 73.199v252c0 63.602-51.602 115.2-115.2 115.2l-543.6 0.003906v-92.398c0-28.801-32.398-44.398-55.199-27.602l-217.2 165.6c-18 13.199-18 40.801 0 55.199l217.2 164.4c22.801 16.801 55.199 1.1992 55.199-27.602v-92.398h544.8c144 0 261.6-117.6 261.6-261.6v-252c-1.2031-39.598-33.602-72-74.402-72z"/><path d="m175.2 692.4v-252c0-63.602 51.602-115.2 115.2-115.2h544.8v92.398c0 28.801 32.398 44.398 55.199 27.602l217.2-165.6c18-13.199 18-40.801 0-55.199l-217.2-164.4c-22.801-16.801-55.199-1.1992-55.199 27.602v92.398h-543.6c-144 0-261.6 117.6-261.6 261.6v252c0 40.801 32.398 73.199 73.199 73.199s72-33.602 72-74.402z"/><text x="600" y="700" text-anchor="middle" font-size="320" font-weight="700" fill="currentColor">1</text>';
    } else if (svg) {
      svg.innerHTML =
        '<path d="m1096.8 434.4c-40.801 0-73.199 32.398-73.199 73.199v252c0 63.602-51.602 115.2-115.2 115.2l-543.6 0.003906v-92.398c0-28.801-32.398-44.398-55.199-27.602l-217.2 165.6c-18 13.199-18 40.801 0 55.199l217.2 164.4c22.801 16.801 55.199 1.1992 55.199-27.602v-92.398h544.8c144 0 261.6-117.6 261.6-261.6v-252c-1.2031-39.598-33.602-72-74.402-72z"/><path d="m175.2 692.4v-252c0-63.602 51.602-115.2 115.2-115.2h544.8v92.398c0 28.801 32.398 44.398 55.199 27.602l217.2-165.6c18-13.199 18-40.801 0-55.199l-217.2-164.4c-22.801-16.801-55.199-1.1992-55.199 27.602v92.398h-543.6c-144 0-261.6 117.6-261.6 261.6v252c0 40.801 32.398 73.199 73.199 73.199s72-33.602 72-74.402z"/>';
    }
  };

  const applyMuteUi = () => {
    if (!muteBtn) return;
    const muted = audio.muted || audio.volume === 0;
    if (volumeIcon) volumeIcon.hidden = muted;
    if (muteIcon) muteIcon.hidden = !muted;
    muteBtn.setAttribute("aria-label", muted ? "Unmute" : "Mute");
  };

  const playAtIndex = (index, seekTime, autoplay) => {
    if (!playlist.length || index < 0 || index >= playlist.length) return;

    queueIndex = index;
    const track = playlist[index];
    showFooter();

    if (titleEl) titleEl.textContent = track.title || "Now playing";
    updateTitleScroll();

    destroyHls();
    audio.pause();

    const manifestUrl = resolveUrl(track.manifest);

    const onReady = () => {
      if (typeof seekTime === "number" && seekTime > 0) {
        audio.currentTime = seekTime;
      }
      if (autoplay !== false) {
        void audio.play().then(() => setPlayIcon(true));
      } else {
        setPlayIcon(false);
      }
      saveState();
    };

    if (typeof Hls !== "undefined" && Hls.isSupported()) {
      hlsInstance = new Hls({ maxBufferLength: 12, maxMaxBufferLength: 20, enableWorker: true });
      hlsInstance.loadSource(manifestUrl);
      hlsInstance.attachMedia(audio);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, onReady);
      hlsInstance.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setPlayIcon(false);
      });
      return;
    }

    if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      audio.src = manifestUrl;
      audio.addEventListener("loadedmetadata", onReady, { once: true });
    }
  };

  const playNext = () => {
    if (repeatMode === "one") {
      audio.currentTime = 0;
      void audio.play();
      return;
    }
    const next = queueIndex + 1;
    if (next < playlist.length) {
      playAtIndex(next, 0, true);
      return;
    }
    if (repeatMode === "all" && playlist.length) {
      playAtIndex(0, 0, true);
    }
  };

  audio.addEventListener("timeupdate", updateScrub);
  audio.addEventListener("loadedmetadata", updateScrub);
  audio.addEventListener("play", () => {
    setPlayIcon(true);
    updateTitleScroll();
    saveState();
  });
  audio.addEventListener("pause", () => {
    setPlayIcon(false);
    if (titleEl) titleEl.classList.remove("is-scrolling");
    saveState();
  });
  audio.addEventListener("ended", playNext);

  playBtn.addEventListener("click", () => {
    if (audio.paused) {
      if (!audio.src && !hlsInstance && playlist.length) {
        playAtIndex(queueIndex, 0, true);
        return;
      }
      void audio.play();
    } else {
      audio.pause();
    }
  });

  if (scrub) {
    const seekFromEvent = (clientX) => {
      const rect = scrub.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const duration = audio.duration || 0;
      if (duration > 0) {
        audio.currentTime = pct * duration;
        updateScrub();
        saveState();
      }
    };

    scrub.addEventListener("click", (e) => seekFromEvent(e.clientX));

    scrub.addEventListener("pointerdown", (e) => {
      isSeeking = true;
      scrub.setPointerCapture(e.pointerId);
      seekFromEvent(e.clientX);
    });
    scrub.addEventListener("pointermove", (e) => {
      if (isSeeking) seekFromEvent(e.clientX);
    });
    scrub.addEventListener("pointerup", () => {
      isSeeking = false;
    });
  }

  if (repeatBtn) {
    repeatBtn.addEventListener("click", () => {
      repeatMode = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
      applyRepeatUi();
      saveState();
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      audio.muted = !audio.muted;
      applyMuteUi();
      saveState();
    });
  }

  if (volumeSlider) {
    volumeSlider.addEventListener("input", () => {
      audio.volume = Number(volumeSlider.value);
      if (audio.volume > 0) audio.muted = false;
      applyMuteUi();
      saveState();
    });
  }

  document.querySelectorAll("[data-play-index]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const index = Number(btn.getAttribute("data-play-index"));
      if (Number.isFinite(index)) playAtIndex(index, 0, true);
    });
  });

  // Persist player across static page navigations
  document.querySelectorAll("a[href]").forEach((link) => {
    link.addEventListener("click", () => saveState());
  });
  window.addEventListener("pagehide", saveState);

  playlist = readPlaylist();

  const saved = loadState();
  if (saved) {
    queueIndex = saved.queueIndex ?? 0;
    repeatMode = saved.repeatMode ?? "off";
    if (typeof saved.volume === "number") audio.volume = saved.volume;
    if (typeof saved.muted === "boolean") audio.muted = saved.muted;
    if (volumeSlider) volumeSlider.value = String(audio.volume);
    applyRepeatUi();
    applyMuteUi();

    if (saved.isPlaying && playlist.length) {
      playAtIndex(queueIndex, saved.currentTime ?? 0, true);
    } else if (playlist.length && queueIndex >= 0) {
      playAtIndex(queueIndex, saved.currentTime ?? 0, false);
    }
  } else {
    const bodyIndex = document.body.getAttribute("data-song-index");
    if (bodyIndex !== null && bodyIndex !== "") {
      queueIndex = Number(bodyIndex);
      applyRepeatUi();
      applyMuteUi();
      if (volumeSlider) volumeSlider.value = String(audio.volume);
      // Song page: load track but wait for user to press play (or restore above)
    } else {
      applyRepeatUi();
      applyMuteUi();
    }
  }

  window.SitePlayer = { playAtIndex, saveState };
})();
