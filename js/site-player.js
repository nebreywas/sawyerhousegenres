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

  /**
   * Older compiled pages embed a flat footer (icon-btn row). Restructure to match
   * src/listener/PlayerBar.tsx so shared CSS applies without recompiling every HTML file.
   */
  const TRANSPORT_ICON = {
    shuffle:
      '<path d="m313.2 730.8c-13.199 14.398-31.199 24-51.602 24h-169.2c-34.801 0-62.398 27.602-62.398 62.398 0 34.801 27.602 62.398 62.398 62.398h169.2c56.398 0 109.2-24 146.4-67.199l60-69.602-82.801-96z"/><path d="m703.2 469.2c13.199-14.398 31.199-24 51.602-24h159.6v72c0 28.801 32.398 45.602 55.199 28.801l186-134.4c19.199-14.398 19.199-43.199 0-56.398l-186-135.6c-22.801-16.801-55.199 0-55.199 28.801v72l-159.6-0.003906c-56.398 0-109.2 24-146.4 67.199l-60 69.602 82.801 96z"/><path d="m1155.6 788.4-186-134.4c-22.801-16.801-55.199 0-55.199 28.801v72h-159.6c-19.199 0-38.398-8.3984-51.602-24l-295.2-343.2c-37.199-43.199-90-67.199-146.4-67.199l-169.2-0.003906c-34.801 0-62.398 27.602-62.398 62.398 0 34.801 27.602 62.398 62.398 62.398h169.2c19.199 0 38.398 8.3984 51.602 24l295.2 343.2c37.199 43.199 90 67.199 146.4 67.199h159.6v72c0 28.801 32.398 45.602 55.199 28.801l186-134.4c19.203-14.395 19.203-43.195 0.003906-57.598z"/>',
    previous:
      '<path d="m1048.8 134.4-602.4 400.8c-46.801 31.199-46.801 98.398 0 129.6l602.4 400.8c51.602 34.801 121.2-2.3984 121.2-64.801l0.003906-801.6c0-62.398-69.602-99.598-121.2-64.801z"/><path d="m238.8 121.2h-170.4c-21.602 0-38.398 18-38.398 38.398v879.6c0 21.602 18 38.398 38.398 38.398h169.2c21.602 0 38.398-18 38.398-38.398l0.003906-879.6c1.1992-21.602-16.801-38.402-37.199-38.402z"/>',
    next:
      '<path d="m151.2 1065.6 602.4-400.8c46.801-31.199 46.801-98.398 0-129.6l-602.4-400.8c-51.598-34.797-121.2 2.4023-121.2 64.801v801.6c0 62.398 69.602 99.598 121.2 64.801z"/><path d="m961.2 1078.8h169.2c21.602 0 38.398-18 38.398-38.398l0.003906-880.8c0-21.602-18-38.398-38.398-38.398l-169.2-0.003906c-21.602 0-38.398 18-38.398 38.398v879.6c0 22.801 18 39.602 38.398 39.602z"/>',
    pause:
      '<path d="m427.2 30h-267.6c-25.199 0-46.801 20.398-46.801 46.801v1047.6c0 25.199 20.398 46.801 46.801 46.801h266.4c25.199 0 46.801-20.398 46.801-46.801v-1047.6c0-26.402-20.402-46.801-45.602-46.801z"/><path d="m1040.4 30h-267.6c-25.199 0-46.801 20.398-46.801 46.801v1047.6c0 25.199 20.398 46.801 46.801 46.801h266.4c25.199 0 46.801-20.398 46.801-46.801v-1047.6c0-26.402-20.398-46.801-45.602-46.801z"/>',
  };

  function createTransportButton(id, label, iconKey, extraClass = "") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = id;
    btn.className = `transport-btn transport-multi${extraClass ? ` ${extraClass}` : ""}`;
    btn.setAttribute("aria-label", label);
    btn.hidden = true;
    btn.innerHTML = `<svg viewBox="0 0 1200 1200" aria-hidden="true" fill="currentColor">${TRANSPORT_ICON[iconKey]}</svg>`;
    return btn;
  }

  /** Add shuffle/prev/next when missing (legacy footers) and ensure pause icon exists. */
  function ensureMultiTrackTransport(transportEl) {
    if (!transportEl) return;
    const play = transportEl.querySelector("#footer-play-btn");
    const repeat = transportEl.querySelector("#footer-repeat-btn");
    if (!play) return;

    if (!play.querySelector(".icon-pause")) {
      play.insertAdjacentHTML(
        "beforeend",
        `<svg class="icon-pause" viewBox="0 0 1200 1200" aria-hidden="true" fill="currentColor">${TRANSPORT_ICON.pause}</svg>`,
      );
    }
    const playIcon = play.querySelector("svg:not(.icon-pause)");
    if (playIcon && !playIcon.classList.contains("icon-play")) {
      playIcon.classList.add("icon-play");
    }

    if (!transportEl.querySelector("#footer-shuffle-btn")) {
      const shuffle = createTransportButton("footer-shuffle-btn", "Shuffle", "shuffle", "transport-btn-shuffle");
      shuffle.setAttribute("aria-pressed", "false");
      transportEl.insertBefore(shuffle, play);
    }
    if (!transportEl.querySelector("#footer-prev-btn")) {
      transportEl.insertBefore(createTransportButton("footer-prev-btn", "Previous", "previous"), play);
    }
    if (!transportEl.querySelector("#footer-next-btn")) {
      const next = createTransportButton("footer-next-btn", "Next", "next");
      if (repeat) transportEl.insertBefore(next, repeat);
      else play.insertAdjacentElement("afterend", next);
    }
  }

  function upgradeLegacyPlayerFooter(footerEl) {
    if (footerEl.querySelector(".player-bar")) {
      footerEl.classList.add("site-player-footer");
      return;
    }

    const play = footerEl.querySelector("#footer-play-btn");
    const title = footerEl.querySelector("#footer-track-title");
    const scrubEl = footerEl.querySelector("#footer-scrub");
    const fillEl = footerEl.querySelector("#footer-scrub-fill");
    const legacyTime = footerEl.querySelector("#footer-time");
    const repeat = footerEl.querySelector("#footer-repeat-btn");
    const mute = footerEl.querySelector("#footer-mute-btn");
    const volume = footerEl.querySelector("#footer-volume");
    const audioEl = footerEl.querySelector("#footer-audio");

    if (!play || !scrubEl || !audioEl) return;

    footerEl.classList.add("site-player-footer");

    play.classList.remove("icon-btn");
    play.classList.add("transport-btn", "transport-btn-primary");
    repeat?.classList.remove("icon-btn", "icon-btn-repeat");
    repeat?.classList.add("transport-btn", "transport-btn-repeat");
    mute?.classList.remove("icon-btn");
    mute?.classList.add("volume-icon");
    scrubEl.classList.add("progress-track");
    fillEl?.classList.add("progress-fill");
    volume?.classList.add("volume-slider");

    const timeCurrent = document.createElement("span");
    timeCurrent.id = "footer-time-current";
    timeCurrent.className = "player-time";
    timeCurrent.textContent = "0:00";

    const timeRemaining = document.createElement("span");
    timeRemaining.id = "footer-time-remaining";
    timeRemaining.className = "player-time player-time-remaining";
    timeRemaining.textContent = "−0:00";

    if (legacyTime) {
      const parts = legacyTime.textContent.split("/").map((part) => part.trim());
      if (parts[0]) timeCurrent.textContent = parts[0];
      if (parts[1]) timeRemaining.textContent = `−${parts[1]}`;
    }

    const nowPlaying = document.createElement("div");
    nowPlaying.className = "player-now-playing";
    if (title) {
      title.classList.add("player-now-playing-text");
      const label = title.textContent.trim();
      if (!/^Now playing:/i.test(label)) {
        title.textContent = `Now playing: ${label || "—"}`;
      }
      nowPlaying.appendChild(title);
    } else {
      const nextTitle = document.createElement("span");
      nextTitle.id = "footer-track-title";
      nextTitle.className = "player-now-playing-text";
      nextTitle.textContent = "Now playing: —";
      nowPlaying.appendChild(nextTitle);
    }

    footerEl.querySelector(".footer-title-wrap")?.remove();
    legacyTime?.remove();

    const transport = document.createElement("div");
    transport.className = "player-transport-controls";
    transport.appendChild(play);
    if (repeat) transport.appendChild(repeat);

    const volumeWrap = document.createElement("div");
    volumeWrap.className = "player-volume";
    if (mute) volumeWrap.appendChild(mute);
    if (volume) volumeWrap.appendChild(volume);

    const progress = document.createElement("div");
    progress.className = "player-progress";
    progress.appendChild(timeCurrent);
    progress.appendChild(scrubEl);
    progress.appendChild(timeRemaining);

    const bar = document.createElement("div");
    bar.className = "player-bar";
    bar.appendChild(transport);
    bar.appendChild(nowPlaying);
    bar.appendChild(volumeWrap);
    bar.appendChild(progress);

    const shell = document.createElement("div");
    shell.className = "site-player-shell panel";
    shell.appendChild(bar);
    shell.appendChild(audioEl);

    shell.appendChild(audioEl);

    footerEl.replaceChildren(shell);
    ensureMultiTrackTransport(bar.querySelector(".player-transport-controls"));
  }

  const footer = document.getElementById("site-player-footer");
  if (footer) {
    upgradeLegacyPlayerFooter(footer);
    ensureMultiTrackTransport(footer.querySelector(".player-transport-controls"));
  }

  const STORAGE_KEY = "artist-site-player-v1";

  const audio = document.getElementById("footer-audio");
  const playBtn = document.getElementById("footer-play-btn");
  const shuffleBtn = document.getElementById("footer-shuffle-btn");
  const prevBtn = document.getElementById("footer-prev-btn");
  const nextBtn = document.getElementById("footer-next-btn");
  const titleEl = document.getElementById("footer-track-title");
  const scrub = document.getElementById("footer-scrub");
  const scrubFill = document.getElementById("footer-scrub-fill");
  const timeCurrentEl = document.getElementById("footer-time-current");
  const timeRemainingEl = document.getElementById("footer-time-remaining");
  const repeatBtn = document.getElementById("footer-repeat-btn");
  const muteBtn = document.getElementById("footer-mute-btn");
  const volumeIcon = muteBtn?.querySelector(".icon-volume");
  const muteIcon = muteBtn?.querySelector(".icon-mute");
  const volumeSlider = document.getElementById("footer-volume");

  if (!footer || !audio || !playBtn) return;

  let hlsInstance = null;
  let playlist = [];
  let singleSongPage = false;
  let queueIndex = 0;
  let shuffle = false;
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
          shuffle,
          pagePath: location.pathname,
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
    playBtn.classList.toggle("is-playing", playing);
    const playIconEl = playBtn.querySelector(".icon-play");
    const pauseIconEl = playBtn.querySelector(".icon-pause");
    // Global CSS uses [hidden]{display:none!important} — toggle the attribute, not just class.
    if (playIconEl) {
      if (playing) playIconEl.setAttribute("hidden", "");
      else playIconEl.removeAttribute("hidden");
    }
    if (pauseIconEl) {
      if (playing) pauseIconEl.removeAttribute("hidden");
      else pauseIconEl.setAttribute("hidden", "");
    }
    playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
  };

  /** Song pages expose one track; artist index exposes the full catalog. */
  const resolvePagePlaylist = (fullPlaylist) => {
    const rawIndex = document.body.getAttribute("data-song-index");
    const isSongPage = rawIndex !== null && rawIndex !== "";
    if (!isSongPage || !fullPlaylist.length) {
      return { playlist: fullPlaylist, singleSongPage: false };
    }

    // New compiles embed only this page's track; legacy pages embed the full catalog.
    if (fullPlaylist.length === 1) {
      return { playlist: fullPlaylist, singleSongPage: true, sourceIndex: 0 };
    }

    const sourceIndex = Number(rawIndex);
    if (!Number.isFinite(sourceIndex) || sourceIndex < 0 || sourceIndex >= fullPlaylist.length) {
      return { playlist: fullPlaylist, singleSongPage: false };
    }

    return {
      playlist: [fullPlaylist[sourceIndex]],
      singleSongPage: true,
      sourceIndex,
    };
  };

  const updateMultiTrackTransport = () => {
    const multi = playlist.length > 1;
    for (const btn of [shuffleBtn, prevBtn, nextBtn]) {
      if (btn) btn.hidden = !multi;
    }
  };

  const applyShuffleUi = () => {
    if (!shuffleBtn) return;
    shuffleBtn.classList.toggle("active", shuffle);
    shuffleBtn.setAttribute("aria-pressed", shuffle ? "true" : "false");
  };

  const pickNextIndex = (currentIndex) => {
    if (!playlist.length) return null;
    if (shuffle) {
      if (playlist.length === 1) return 0;
      let next = currentIndex;
      while (next === currentIndex) {
        next = Math.floor(Math.random() * playlist.length);
      }
      return next;
    }
    if (currentIndex + 1 < playlist.length) return currentIndex + 1;
    if (repeatMode === "all") return 0;
    return null;
  };

  const updateTitleScroll = () => {
    if (!titleEl) return;
    titleEl.classList.remove("is-scrolling");
    titleEl.style.removeProperty("--scroll-distance");
    titleEl.style.removeProperty("--scroll-duration");

    requestAnimationFrame(() => {
      const wrap = titleEl.parentElement;
      if (!wrap || titleEl.scrollWidth <= wrap.clientWidth + 2) return;
      const distance = titleEl.scrollWidth - wrap.clientWidth;
      titleEl.style.setProperty("--scroll-distance", `${distance}px`);
      titleEl.style.setProperty("--scroll-duration", `${Math.max(10, distance / 18)}s`);
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
    if (timeCurrentEl) timeCurrentEl.textContent = formatTime(current);
    if (timeRemainingEl) {
      const remaining = duration > 0 ? Math.max(0, duration - current) : 0;
      timeRemainingEl.textContent = `−${formatTime(remaining)}`;
    }
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
    repeatBtn.classList.toggle("active", repeatMode !== "off");
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

    if (titleEl) {
      const label = track.title || "—";
      titleEl.textContent = `Now playing: ${label}`;
    }
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

  const playPrevious = () => {
    if (!playlist.length) return;
    if (queueIndex > 0) {
      playAtIndex(queueIndex - 1, 0, true);
      return;
    }
    if (repeatMode === "all" && playlist.length > 1) {
      playAtIndex(playlist.length - 1, 0, true);
    }
  };

  const playNext = () => {
    if (repeatMode === "one") {
      audio.currentTime = 0;
      void audio.play();
      return;
    }
    const next = pickNextIndex(queueIndex);
    if (next != null) playAtIndex(next, 0, true);
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

  if (shuffleBtn) {
    shuffleBtn.addEventListener("click", () => {
      shuffle = !shuffle;
      applyShuffleUi();
      saveState();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => playPrevious());
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => playNext());
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
      if (singleSongPage) {
        playAtIndex(0, 0, true);
        return;
      }
      const index = Number(btn.getAttribute("data-play-index"));
      if (Number.isFinite(index)) playAtIndex(index, 0, true);
    });
  });

  // Persist player across static page navigations
  document.querySelectorAll("a[href]").forEach((link) => {
    link.addEventListener("click", () => saveState());
  });
  window.addEventListener("pagehide", saveState);

  const fullPlaylist = readPlaylist();
  const pageContext = resolvePagePlaylist(fullPlaylist);
  playlist = pageContext.playlist;
  singleSongPage = pageContext.singleSongPage;
  updateMultiTrackTransport();

  const saved = loadState();
  const samePage = saved?.pagePath === location.pathname;

  if (saved) {
    repeatMode = saved.repeatMode ?? "off";
    shuffle = singleSongPage ? false : (saved.shuffle ?? false);
    if (typeof saved.volume === "number") audio.volume = saved.volume;
    if (typeof saved.muted === "boolean") audio.muted = saved.muted;
    if (volumeSlider) volumeSlider.value = String(audio.volume);
    applyRepeatUi();
    applyShuffleUi();
    applyMuteUi();

    if (singleSongPage) {
      queueIndex = 0;
      if (samePage && playlist.length) {
        if (saved.isPlaying) {
          playAtIndex(0, saved.currentTime ?? 0, true);
        } else {
          playAtIndex(0, saved.currentTime ?? 0, false);
        }
      }
    } else {
      queueIndex = saved.queueIndex ?? 0;
      if (saved.isPlaying && playlist.length) {
        playAtIndex(queueIndex, saved.currentTime ?? 0, true);
      } else if (playlist.length && queueIndex >= 0) {
        playAtIndex(queueIndex, saved.currentTime ?? 0, false);
      }
    }
  } else {
    queueIndex = singleSongPage ? 0 : queueIndex;
    applyRepeatUi();
    applyShuffleUi();
    applyMuteUi();
    if (volumeSlider) volumeSlider.value = String(audio.volume);
  }

  setPlayIcon(!audio.paused);

  window.SitePlayer = { playAtIndex, saveState };
})();
