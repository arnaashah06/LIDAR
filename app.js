/**
 * Spatial Sentinel — Interactive LiDAR Simulation Engine & Web Controller
 * Restored to exact original UI/UX, color palette, and layout
 * with the SIH Budget Controller and Telemetry Add-On features kept constant.
 */

(function () {
  'use strict';

  // ─── Sound Synthesizer (Web Audio API) ───────────────────────────────────────
  const audioCtx = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;
  function playClickSound(freq = 880, type = 'sine', duration = 0.06) {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio fallback
    }
  }

  // ─── Data Models & State (Exact Original) ──────────────────────────────────
  const COLS = 18;
  const ROWS = 11;

  const CellKind = {
    STABLE: 'stable',
    CHANGE: 'change',
    UNCERTAIN: 'uncertain',
    EMPTY: 'empty'
  };

  let isScanning = true;
  let showAdaptiveResolution = true;
  let currentMode = 'overview'; // 'overview', 'confidence', 'changes', 'mesh3d'
  let activeTab = 'motion';
  let snapshotCount = 12;
  let confidenceVal = 87;

  // Add-On Feature: Compute Budget State (Kept Constant)
  let memoryBudgetLimitKB = 45;
  let actualMemoryKB = 34.8;
  let actualLatencyMs = 3.6;
  let actualRmseCm = 1.4;

  // 3D Orbit State
  let rotX = 0.45;
  let rotY = -0.35;
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  // Active scenario
  let currentScenario = 'baseline';

  class MapCell {
    constructor(col, row, kind, height = 0, semantic = 'Floor', confidence = 95) {
      this.col = col;
      this.row = row;
      this.kind = kind;
      this.height = height; // in meters (2.5D height)
      this.semantic = semantic;
      this.confidence = confidence; // 0..100
      this.displacement = 0; // cm
      this.variance = 0.003; // Kalman uncertainty (m²)
    }
  }

  let cells = [];

  function buildGrid(scenario = 'baseline') {
    cells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const isNorthWall = (r === 1 && c > 1 && c < 16);
        const isTable = (r > 5 && r < 8 && c > 4 && c < 12);
        let isChange = (r > 3 && r < 6 && c > 13 && c < 16);
        let isUncertain = (r > 7 && c < 4);
        let kind = CellKind.EMPTY;
        let height = 0;
        let semantic = 'Floor';
        let conf = 96;
        let displacement = 0;

        if (scenario === 'baseline') {
          if (isChange) {
            kind = CellKind.CHANGE;
            height = 0.75;
            semantic = 'Table Cluster';
            conf = 92;
            displacement = 24;
          } else if (isUncertain) {
            kind = CellKind.UNCERTAIN;
            height = 0.1;
            semantic = 'Doorway Pocket';
            conf = 48;
          } else if (isNorthWall) {
            kind = CellKind.STABLE;
            height = 2.4;
            semantic = 'North Wall';
            conf = 98;
          } else if (isTable) {
            kind = CellKind.STABLE;
            height = 0.78;
            semantic = 'Conference Table';
            conf = 95;
          } else if (c > 2 && c < 16 && r > 2) {
            kind = CellKind.STABLE;
            height = 0.05;
            semantic = 'Floor';
            conf = 97;
          }
        } else if (scenario === 'doorway') {
          const isDoorwayObstacle = (r >= 8 && r <= 10 && c >= 1 && c <= 3);
          if (isDoorwayObstacle) {
            kind = CellKind.CHANGE;
            height = 0.65;
            semantic = 'Doorway Obstacle (Box)';
            conf = 91;
            displacement = 0;
          } else if (isNorthWall) {
            kind = CellKind.STABLE;
            height = 2.4;
            semantic = 'North Wall';
            conf = 98;
          } else if (isTable) {
            kind = CellKind.STABLE;
            height = 0.78;
            semantic = 'Conference Table';
            conf = 95;
          } else if (c > 2 && c < 16 && r > 2) {
            kind = CellKind.STABLE;
            height = 0.05;
            semantic = 'Floor';
            conf = 96;
          }
        } else if (scenario === 'person') {
          const isPerson = (r >= 4 && r <= 5 && c >= 7 && c <= 9);
          if (isPerson) {
            kind = CellKind.CHANGE;
            height = 1.72;
            semantic = 'Anonymous Motion Volume';
            conf = 88;
            displacement = 140;
          } else if (isNorthWall) {
            kind = CellKind.STABLE;
            height = 2.4;
            semantic = 'North Wall';
            conf = 98;
          } else if (isTable) {
            kind = CellKind.STABLE;
            height = 0.78;
            semantic = 'Conference Table';
            conf = 95;
          } else if (c > 2 && c < 16 && r > 2) {
            kind = CellKind.STABLE;
            height = 0.05;
            semantic = 'Floor';
            conf = 96;
          }
        } else if (scenario === 'chair') {
          const isChairShift = (r >= 6 && r <= 7 && c >= 12 && c <= 14);
          if (isChairShift) {
            kind = CellKind.CHANGE;
            height = 0.90;
            semantic = 'Shifted Chair';
            conf = 94;
            displacement = 38;
          } else if (isNorthWall) {
            kind = CellKind.STABLE;
            height = 2.4;
            semantic = 'North Wall';
            conf = 98;
          } else if (isTable) {
            kind = CellKind.STABLE;
            height = 0.78;
            semantic = 'Conference Table';
            conf = 95;
          } else if (c > 2 && c < 16 && r > 2) {
            kind = CellKind.STABLE;
            height = 0.05;
            semantic = 'Floor';
            conf = 96;
          }
        }

        cells.push(new MapCell(c, r, kind, height, semantic, conf));
      }
    }

    applyComputeBudget();
  }

  // ─── Add-On: Compute Budget Controller (Kept Constant) ─────────────────────
  function applyComputeBudget() {
    let activeCellCount = 0;
    cells.forEach(cell => {
      if (cell.kind !== CellKind.EMPTY) {
        activeCellCount++;
      }
    });

    actualMemoryKB = Math.min(memoryBudgetLimitKB, (18.4 + (memoryBudgetLimitKB / 220) * (activeCellCount * 0.22))).toFixed(1);
    actualLatencyMs = (1.5 + (actualMemoryKB / 220) * 12.0).toFixed(1);
    actualRmseCm = (0.9 + (220 - memoryBudgetLimitKB) / 220 * 1.8).toFixed(1);

    const readoutMemory = document.getElementById('readout-memory');
    const readoutLatency = document.getElementById('readout-latency');
    const readoutRmse = document.getElementById('readout-rmse');
    const benchOursMem = document.getElementById('bench-ours-mem');
    const benchOursLat = document.getElementById('bench-ours-lat');

    if (readoutMemory) readoutMemory.textContent = `${actualMemoryKB} KB`;
    if (readoutLatency) readoutLatency.textContent = `${actualLatencyMs} ms`;
    if (readoutRmse) readoutRmse.textContent = `±${actualRmseCm} cm`;
    if (benchOursMem) benchOursMem.textContent = `${actualMemoryKB} KB (-88%)`;
    if (benchOursLat) benchOursLat.textContent = `${actualLatencyMs} ms`;
  }

  buildGrid('baseline');

  // ─── DOM References ────────────────────────────────────────────────────────
  const canvas = document.getElementById('spatial-canvas');
  const ctx = canvas.getContext('2d');
  const tooltip = document.getElementById('cell-tooltip');
  const ttHeader = document.getElementById('tt-header');
  const ttType = document.getElementById('tt-type');
  const ttDepth = document.getElementById('tt-depth');
  const ttConfidence = document.getElementById('tt-confidence');
  const ttDelta = document.getElementById('tt-delta');

  const btnToggleScan = document.getElementById('btn-toggle-scan');
  const iconPause = document.getElementById('icon-pause');
  const iconPlay = document.getElementById('icon-play');
  const statusTitleText = document.getElementById('status-title-text');
  const statusSubText = document.getElementById('status-sub-text');
  const islandLidar = document.getElementById('island-lidar');

  const confidenceArc = document.getElementById('confidence-arc');
  const confidenceValEl = document.getElementById('confidence-val');

  const toggleAdaptive = document.getElementById('toggle-adaptive');
  const metricSnapshotsVal = document.getElementById('metric-snapshots-val');
  const metricCompressionVal = document.getElementById('metric-compression-val');
  const btnCaptureSnapshot = document.getElementById('btn-capture-snapshot');

  const modeTriggerBtn = document.getElementById('mode-trigger-btn');
  const modeDropdownMenu = document.getElementById('mode-dropdown-menu');
  const currentModeName = document.getElementById('current-mode-name');

  const budgetSlider = document.getElementById('budget-slider');
  const budgetSliderVal = document.getElementById('budget-slider-val');
  const budgetModeBadge = document.getElementById('budget-mode-badge');
  const presetButtons = document.querySelectorAll('.preset-btn');

  const segButtons = document.querySelectorAll('.seg-btn');
  const tabPanels = {
    motion: document.getElementById('tab-motion'),
    predict: document.getElementById('tab-predict'),
    privacy: document.getElementById('tab-privacy')
  };

  const changesList = document.getElementById('changes-list');
  const auditLogs = document.getElementById('audit-logs');
  const depthBarsContainer = document.getElementById('depth-bars');
  const diagClearance = document.getElementById('diag-clearance');
  const diagClearanceSub = document.getElementById('diag-clearance-sub');
  const toastContainer = document.getElementById('toast-container');

  // Clock
  function updateClock() {
    const clockEl = document.getElementById('status-clock');
    if (!clockEl) return;
    const now = new Date();
    let hours = now.getHours();
    let mins = now.getMinutes();
    hours = hours % 12 || 12;
    mins = mins < 10 ? '0' + mins : mins;
    clockEl.textContent = `${hours}:${mins}`;
  }
  setInterval(updateClock, 1000);
  updateClock();

  // ─── Add-On: Depth Waveform (Kept Constant) ────────────────────────────────
  function initDepthBars() {
    if (!depthBarsContainer) return;
    depthBarsContainer.innerHTML = '';
    const numBars = 36;
    for (let i = 0; i < numBars; i++) {
      const bar = document.createElement('div');
      bar.className = 'wave-bar';
      const h = 8 + Math.floor(Math.random() * 38);
      bar.style.height = `${h}px`;
      depthBarsContainer.appendChild(bar);
    }
  }
  initDepthBars();

  setInterval(() => {
    if (!isScanning || !depthBarsContainer) return;
    const bars = depthBarsContainer.querySelectorAll('.wave-bar');
    bars.forEach((bar, idx) => {
      const base = 10 + Math.sin(Date.now() * 0.003 + idx * 0.3) * 16 + Math.random() * 12;
      bar.style.height = `${Math.max(4, Math.min(50, base))}px`;
      if (base > 32) bar.classList.add('peak');
      else bar.classList.remove('peak');
    });
  }, 180);

  // ─── Toasts & Logs ─────────────────────────────────────────────────────────
  function showToast(message, icon = '📡') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    toastContainer.appendChild(toast);
    playClickSound(1040, 'sine', 0.08);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function appendLog(tag, msg, color = 'cyan') {
    if (!auditLogs) return;
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const log = document.createElement('div');
    log.className = 'log-entry';
    log.innerHTML = `
      <span class="log-time">${timeStr}</span>
      <span class="log-tag ${color}">${tag}</span>
      <span class="log-msg">${msg}</span>
    `;
    auditLogs.prepend(log);
  }

  // ─── Canvas Rendering Loop (Exact Original Color Palette & Styling) ────────
  let startTime = performance.now();
  let hoveredCell = null;

  function render2DMap(timestamp) {
    const elapsed = (timestamp - startTime) / 1000;
    const width = canvas.width;
    const height = canvas.height;
    const colW = width / COLS;
    const rowH = height / ROWS;

    // Dark Map Background (Exact Original)
    ctx.fillStyle = '#060910';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * colW, 0);
      ctx.lineTo(c * colW, height);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * rowH);
      ctx.lineTo(width, r * rowH);
      ctx.stroke();
    }

    // Render Each Cell (Exact Original Colors: Cyan, Orange, Pink)
    for (const cell of cells) {
      if (cell.kind === CellKind.EMPTY) continue;

      const x = cell.col * colW;
      const y = cell.row * rowH;

      const pulse = (isScanning && cell.kind === CellKind.CHANGE)
        ? 0.15 + Math.abs(Math.sin(elapsed * 2.8)) * 0.25
        : 0;

      const inset = (showAdaptiveResolution && cell.kind === CellKind.STABLE) ? 2.5 : 1;
      const cellW = colW - inset * 2;
      const cellH = rowH - inset * 2;
      const radius = cell.kind === CellKind.STABLE ? 4 : 6;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x + inset, y + inset, cellW, cellH, radius);

      if (currentMode === 'confidence') {
        const confAlpha = (cell.confidence / 100) * 0.85;
        if (cell.confidence > 80) {
          ctx.fillStyle = `rgba(16, 185, 129, ${confAlpha})`;
        } else if (cell.confidence > 60) {
          ctx.fillStyle = `rgba(234, 179, 8, ${confAlpha})`;
        } else {
          ctx.fillStyle = `rgba(236, 72, 153, 0.9)`;
        }
      } else if (currentMode === 'changes') {
        if (cell.kind === CellKind.CHANGE) {
          ctx.fillStyle = `rgba(249, 115, 22, ${0.85 + pulse})`;
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        }
      } else {
        // Overview mode (Exact Original Colors)
        if (cell.kind === CellKind.STABLE) {
          ctx.fillStyle = `rgba(6, 182, 212, 0.32)`;
        } else if (cell.kind === CellKind.CHANGE) {
          ctx.fillStyle = `rgba(249, 115, 22, ${0.72 + pulse})`;
        } else if (cell.kind === CellKind.UNCERTAIN) {
          ctx.fillStyle = 'rgba(236, 72, 153, 0.82)';
        }
      }
      ctx.fill();

      // Border for changes (Original Orange Glow)
      if (cell.kind === CellKind.CHANGE) {
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = 'rgba(249, 115, 22, 0.5)';
        ctx.shadowBlur = 8;
        ctx.stroke();
      }

      // Adaptive Resolution Micro-Grid Subdivision
      if (showAdaptiveResolution && (cell.kind === CellKind.CHANGE || cell.kind === CellKind.UNCERTAIN)) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x + colW / 2, y + inset);
        ctx.lineTo(x + colW / 2, y + rowH - inset);
        ctx.moveTo(x + inset, y + rowH / 2);
        ctx.lineTo(x + colW - inset, y + rowH / 2);
        ctx.stroke();
      }

      // Hover highlight
      if (hoveredCell && hoveredCell.col === cell.col && hoveredCell.row === cell.row) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.stroke();
      }

      ctx.restore();
    }

    // Laser Sweeping Line (Exact Original Cyan Laser Beam)
    if (isScanning) {
      const scanLineX = ((elapsed * 16) % 100) / 100 * width;

      const grad = ctx.createLinearGradient(scanLineX - 45, 0, scanLineX, 0);
      grad.addColorStop(0, 'rgba(6, 182, 212, 0)');
      grad.addColorStop(1, 'rgba(6, 182, 212, 0.2)');
      ctx.fillStyle = grad;
      ctx.fillRect(scanLineX - 45, 0, 45, height);

      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(scanLineX, 0);
      ctx.lineTo(scanLineX, height);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // ─── 3D LiDAR Mode Renderer (Exact Original) ───────────────────────────────
  function render3DLiDAR(timestamp) {
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#060910';
    ctx.fillRect(0, 0, width, height);

    const originX = width / 2;
    const originY = height / 2 + 50;
    const scale = 14;

    const sorted = [...cells].sort((a, b) => {
      const depthA = (a.col * Math.sin(rotY)) + (a.row * Math.cos(rotY));
      const depthB = (b.col * Math.sin(rotY)) + (b.row * Math.cos(rotY));
      return depthA - depthB;
    });

    for (const cell of sorted) {
      if (cell.kind === CellKind.EMPTY) continue;

      const cx = (cell.col - COLS / 2) * scale;
      const cz = (cell.row - ROWS / 2) * scale;
      const cy = -(cell.height * 24);

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      const x1 = cx * cosY - cz * sinY;
      const z1 = cx * sinY + cz * cosY;

      const y1 = cy * cosX - z1 * sinX;
      const z2 = cy * sinX + z1 * cosX;

      const yFloor = 0 * cosX - z1 * sinX;

      const fov = 350;
      const factor = fov / (fov + z2);

      const px = originX + x1 * factor;
      const py = originY + y1 * factor;
      const pyFloor = originY + yFloor * factor;

      let color = 'rgba(6, 182, 212, 0.7)';
      if (cell.kind === CellKind.CHANGE) color = '#f97316';
      else if (cell.kind === CellKind.UNCERTAIN) color = '#ec4899';

      if (cell.height > 0.1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, 2 * factor);
        ctx.beginPath();
        ctx.moveTo(px, pyFloor);
        ctx.lineTo(px, py);
        ctx.stroke();
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      const ptRadius = Math.max(2, 4 * factor);
      ctx.arc(px, py, ptRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '11px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('3D LiDAR Mesh: Drag to orbit & inspect height profile', 14, height - 14);
  }

  function renderLoop(timestamp) {
    if (currentMode === 'mesh3d') {
      render3DLiDAR(timestamp);
    } else {
      render2DMap(timestamp);
    }
    renderStationCanvases(timestamp);
    requestAnimationFrame(renderLoop);
  }

  requestAnimationFrame(renderLoop);

  // ─── Mouse / Touch Hover & Drag Interaction ────────────────────────────────
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (currentMode === 'mesh3d' && isDragging) {
      const dx = mouseX - lastMouseX;
      const dy = mouseY - lastMouseY;
      rotY += dx * 0.01;
      rotX = Math.max(0.1, Math.min(1.2, rotX + dy * 0.01));
      lastMouseX = mouseX;
      lastMouseY = mouseY;
      return;
    }

    if (currentMode !== 'mesh3d') {
      const colW = rect.width / COLS;
      const rowH = rect.height / ROWS;
      const col = Math.floor(mouseX / colW);
      const row = Math.floor(mouseY / rowH);

      const found = cells.find(c => c.col === col && c.row === row);
      if (found && found.kind !== CellKind.EMPTY) {
        hoveredCell = found;
        tooltip.classList.remove('hidden');
        tooltip.style.left = `${Math.min(rect.width - 160, mouseX + 12)}px`;
        tooltip.style.top = `${Math.min(rect.height - 110, mouseY + 12)}px`;

        ttHeader.textContent = `Cell (${found.col}, ${found.row})`;
        ttType.textContent = `Surface: ${found.semantic}`;
        ttDepth.textContent = `Depth: ${(1.2 + found.row * 0.28).toFixed(2)}m • Z: ${found.height}m`;
        ttConfidence.textContent = `Confidence: ${found.confidence}%`;

        if (found.kind === CellKind.CHANGE) {
          ttDelta.textContent = `Delta: Displaced +${found.displacement}cm`;
          ttDelta.style.color = '#f97316';
        } else if (found.kind === CellKind.UNCERTAIN) {
          ttDelta.textContent = `Status: Low Confidence Zone`;
          ttDelta.style.color = '#ec4899';
        } else {
          ttDelta.textContent = `Status: Stable Baseline`;
          ttDelta.style.color = '#10b981';
        }
      } else {
        hoveredCell = null;
        tooltip.classList.add('hidden');
      }
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = canvas.getBoundingClientRect();
    lastMouseX = e.clientX - rect.left;
    lastMouseY = e.clientY - rect.top;
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  canvas.addEventListener('mouseleave', () => {
    hoveredCell = null;
    tooltip.classList.add('hidden');
    isDragging = false;
  });

  canvas.addEventListener('click', () => {
    if (hoveredCell) {
      playClickSound(920, 'sine', 0.05);
      showToast(`Selected (${hoveredCell.col}, ${hoveredCell.row}) — ${hoveredCell.semantic}`, '🎯');
    }
  });

  // ─── Play / Pause Toggle ───────────────────────────────────────────────────
  btnToggleScan.addEventListener('click', () => {
    isScanning = !isScanning;
    playClickSound(640, 'triangle', 0.08);

    const bannerPlayBtn = document.getElementById('banner-play-btn');

    if (isScanning) {
      iconPause.classList.remove('hidden');
      iconPlay.classList.add('hidden');
      if (bannerPlayBtn) bannerPlayBtn.textContent = '⏸';
      statusTitleText.textContent = 'Live scan active';
      statusSubText.textContent = 'Confidence is high across the mapped area';
      islandLidar.style.display = 'flex';
      appendLog('SCAN', 'ARKit LiDAR session resumed (sceneDepth streaming).', 'cyan');
    } else {
      iconPause.classList.add('hidden');
      iconPlay.classList.remove('hidden');
      if (bannerPlayBtn) bannerPlayBtn.textContent = '▶';
      statusTitleText.textContent = 'Scan paused';
      statusSubText.textContent = 'LiDAR frame streaming on hold';
      islandLidar.style.display = 'none';
      appendLog('PAUSE', 'ARKit session paused. State cached in memory.', 'orange');
    }
  });

  // ─── Adaptive Resolution Toggle ────────────────────────────────────────────
  toggleAdaptive.addEventListener('change', (e) => {
    showAdaptiveResolution = e.target.checked;
    playClickSound(760, 'sine', 0.05);

    if (showAdaptiveResolution) {
      metricCompressionVal.textContent = '38%';
      showToast('Adaptive resolution enabled: spending detail where motion occurs', '⚡');
      appendLog('ADAPT', 'Quadtree adaptive subdivision ON (-38% memory saving).', 'green');
    } else {
      metricCompressionVal.textContent = '0%';
      showToast('Adaptive resolution disabled: uniform coarse grid active', 'ℹ️');
      appendLog('ADAPT', 'Quadtree turned off. Uniform grid active.', 'cyan');
    }
    applyComputeBudget();
  });

  // ─── Add-On: Compute Budget Slider & Presets (Kept Constant) ────────────────
  budgetSlider.addEventListener('input', (e) => {
    memoryBudgetLimitKB = parseInt(e.target.value, 10);
    budgetSliderVal.textContent = `${memoryBudgetLimitKB} KB`;
    budgetModeBadge.textContent = `Target: ${memoryBudgetLimitKB} KB / ${(1.5 + memoryBudgetLimitKB * 0.05).toFixed(1)} ms`;
    applyComputeBudget();
  });

  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const bgt = parseInt(btn.dataset.budget, 10);
      memoryBudgetLimitKB = bgt;
      budgetSlider.value = bgt;
      budgetSliderVal.textContent = `${bgt} KB`;
      budgetModeBadge.textContent = `Target: ${bgt} KB / ${(1.5 + bgt * 0.05).toFixed(1)} ms`;
      playClickSound(820, 'sine', 0.05);

      showToast(`Hardware profile: ${btn.querySelector('.preset-title').textContent}`, '⚙️');
      appendLog('BUDGET', `Hardware budget governor set to ${bgt} KB limit.`, 'cyan');
      applyComputeBudget();
    });
  });

  // ─── Snapshot Capture Action ───────────────────────────────────────────────
  btnCaptureSnapshot.addEventListener('click', () => {
    snapshotCount += 1;
    metricSnapshotsVal.textContent = snapshotCount;
    playClickSound(1200, 'sine', 0.1);

    btnCaptureSnapshot.style.transform = 'scale(0.92)';
    setTimeout(() => btnCaptureSnapshot.style.transform = '', 120);

    showToast(`Snapshot #${snapshotCount} captured & aligned to WorldMap`, '📸');
    appendLog('SNAP', `Snapshot #${snapshotCount} saved. 2.5D elevation grid updated.`, 'green');
  });

  document.getElementById('card-snapshot-metric').addEventListener('click', () => {
    btnCaptureSnapshot.click();
  });

  // ─── Mode Switcher Menu ────────────────────────────────────────────────────
  modeTriggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    modeDropdownMenu.classList.toggle('open');
    playClickSound(800, 'sine', 0.04);
  });

  document.addEventListener('click', () => {
    modeDropdownMenu.classList.remove('open');
  });

  const dropdownItems = document.querySelectorAll('.dropdown-item');
  dropdownItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const mode = item.dataset.mode;
      currentMode = mode;
      currentModeName.textContent = item.querySelector('span').textContent;
      modeDropdownMenu.classList.remove('open');
      playClickSound(1000, 'sine', 0.06);

      showToast(`View mode switched to: ${item.querySelector('span').textContent}`, '👁️');
      appendLog('VIEW', `Visualization layer switched to: ${mode}`, 'cyan');
    });
  });

  // ─── Segmented Intelligence Tabs (Exact Original) ──────────────────────────
  segButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      segButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      playClickSound(850, 'sine', 0.04);

      Object.keys(tabPanels).forEach(key => {
        if (key === activeTab) {
          tabPanels[key].classList.remove('hidden');
          tabPanels[key].classList.add('active');
        } else {
          tabPanels[key].classList.add('hidden');
          tabPanels[key].classList.remove('active');
        }
      });
    });
  });

  // ─── Blueprint Scenario Simulations (Exact Original Set) ───────────────────
  const btnSceneBaseline = document.getElementById('btn-scene-baseline');
  const btnSceneDoorway = document.getElementById('btn-scene-doorway');
  const btnScenePerson = document.getElementById('btn-scene-person');
  const btnSceneChair = document.getElementById('btn-scene-chair');
  const allSceneBtns = [btnSceneBaseline, btnSceneDoorway, btnScenePerson, btnSceneChair];

  function setActiveSceneBtn(activeBtn) {
    allSceneBtns.forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
  }

  btnSceneBaseline.addEventListener('click', () => {
    setActiveSceneBtn(btnSceneBaseline);
    currentScenario = 'baseline';
    buildGrid('baseline');
    confidenceVal = 87;
    confidenceValEl.textContent = '87%';
    confidenceArc.style.strokeDashoffset = '19.6';
    diagClearance.textContent = '102 cm';
    diagClearanceSub.textContent = 'Doorway Normal';
    playClickSound(880, 'sine', 0.08);

    changesList.innerHTML = `
      <div class="change-row">
        <div class="change-icon-badge orange">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
        </div>
        <div class="change-texts">
          <div class="change-title">Object moved</div>
          <div class="change-desc">Table edge shifted 24 cm</div>
        </div>
        <div class="change-time">Now</div>
      </div>
      <div class="change-row">
        <div class="change-icon-badge cyan">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="7" r="4"></circle><path d="M5.5 21a6.5 6.5 0 0 1 13 0"></path><path d="M2 7h3M19 7h3M2 17h3M19 17h3"></path></svg>
        </div>
        <div class="change-texts">
          <div class="change-title">Motion cluster tracked</div>
          <div class="change-desc">Anonymous moving volume crossed the map</div>
        </div>
        <div class="change-time">8s</div>
      </div>
      <div class="change-row">
        <div class="change-icon-badge pink">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
        <div class="change-texts">
          <div class="change-title">Uncertain region</div>
          <div class="change-desc">Scan recommended near doorway</div>
        </div>
        <div class="change-time">2m</div>
      </div>
    `;

    showToast('Reset to Baseline Room Scan', '🔄');
    appendLog('RESET', 'Loaded reference baseline geometry.', 'cyan');
  });

  btnSceneDoorway.addEventListener('click', () => {
    setActiveSceneBtn(btnSceneDoorway);
    currentScenario = 'doorway';
    buildGrid('doorway');
    confidenceVal = 91;
    confidenceValEl.textContent = '91%';
    confidenceArc.style.strokeDashoffset = '13.5';
    diagClearance.textContent = '38 cm';
    diagClearanceSub.textContent = 'CRITICAL (-62%)';
    diagClearance.style.color = '#f97316';
    playClickSound(520, 'sawtooth', 0.15);

    changesList.innerHTML = `
      <div class="change-row" style="background: rgba(249, 115, 22, 0.12); border-color: rgba(249, 115, 22, 0.4);">
        <div class="change-icon-badge orange">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <div class="change-texts">
          <div class="change-title" style="color: #f97316;">SAFETY ALERT: Exit Obstructed</div>
          <div class="change-desc">Exit clearance reduced by 62%. New obstacle detected with 91% confidence.</div>
        </div>
        <div class="change-time">Now</div>
      </div>
      <div class="change-row">
        <div class="change-icon-badge cyan">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="7" r="4"></circle><path d="M5.5 21a6.5 6.5 0 0 1 13 0"></path></svg>
        </div>
        <div class="change-texts">
          <div class="change-title">Doorway Zone Monitored</div>
          <div class="change-desc">Safety rule: clearance threshold = 80 cm</div>
        </div>
        <div class="change-time">12s</div>
      </div>
    `;

    showToast('CRITICAL: Exit clearance reduced by 62%!', '⚠️');
    appendLog('ALERT', 'Blocked doorway rule triggered! Clearance: 38cm (Min 80cm required).', 'orange');
  });

  btnScenePerson.addEventListener('click', () => {
    setActiveSceneBtn(btnScenePerson);
    currentScenario = 'person';
    buildGrid('person');
    playClickSound(880, 'sine', 0.08);

    changesList.innerHTML = `
      <div class="change-row" style="background: rgba(6, 182, 212, 0.12); border-color: rgba(6, 182, 212, 0.35);">
        <div class="change-icon-badge cyan">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="7" r="4"></circle><path d="M5.5 21a6.5 6.5 0 0 1 13 0"></path><path d="M2 7h3M19 7h3M2 17h3M19 17h3"></path></svg>
        </div>
        <div class="change-texts">
          <div class="change-title" style="color: #22d3ee;">Anonymous Motion Volume</div>
          <div class="change-desc">Transient occlusion masked; static room baseline preserved. Privacy ON.</div>
        </div>
        <div class="change-time">Now</div>
      </div>
    `;

    showToast('Tracking anonymous motion volume (identity suppressed)', '🚶');
    appendLog('MOTION', 'Person tracked: velocity 0.85 m/s. Faces/identity suppressed.', 'cyan');
  });

  btnSceneChair.addEventListener('click', () => {
    setActiveSceneBtn(btnSceneChair);
    currentScenario = 'chair';
    buildGrid('chair');
    playClickSound(880, 'sine', 0.08);

    changesList.innerHTML = `
      <div class="change-row">
        <div class="change-icon-badge orange">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
        </div>
        <div class="change-texts">
          <div class="change-title">Furniture Shift Detected</div>
          <div class="change-desc">Office chair shifted 38 cm; persistence score 0.96</div>
        </div>
        <div class="change-time">Now</div>
      </div>
    `;

    showToast('Detected persistent furniture displacement: 38 cm', '🪑');
    appendLog('CHANGE', 'Persistent object displacement: 38 cm. Motion score 0.96.', 'orange');
  });

  // ─── View Toggle (Phone Frame vs Station View) ─────────────────────────────
  const toggleDeviceView = document.getElementById('toggle-device-view');
  const toggleStationView = document.getElementById('toggle-station-view');
  const appLayout = document.getElementById('app-layout');

  toggleDeviceView.addEventListener('click', () => {
    toggleDeviceView.classList.add('active');
    toggleStationView.classList.remove('active');
    appLayout.classList.add('phone-only');
    playClickSound(750, 'sine', 0.05);
  });

  toggleStationView.addEventListener('click', () => {
    toggleStationView.classList.add('active');
    toggleDeviceView.classList.remove('active');
    appLayout.classList.remove('phone-only');
    playClickSound(750, 'sine', 0.05);
  });

  // ─── 6-Card Control Station Logic & Interactive Canvases ────────────────────
  const sliderDensity = document.getElementById('slider-density');
  const sliderBandwidth = document.getElementById('slider-bandwidth');
  const sliderLatency = document.getElementById('slider-latency');
  const valDensity = document.getElementById('val-density');
  const valBandwidth = document.getElementById('val-bandwidth');
  const valLatency = document.getElementById('val-latency');
  const controllerFpsBadge = document.getElementById('controller-fps-badge');
  const controllerFpsVal = document.getElementById('controller-fps-val');

  const lidarStreamCanvas = document.getElementById('lidar-stream-canvas');
  const lidarStreamCtx = lidarStreamCanvas ? lidarStreamCanvas.getContext('2d') : null;

  const accGhost = document.getElementById('acc-ghost');
  const accQuadtree1 = document.getElementById('acc-quadtree1');
  const accQuadtree2 = document.getElementById('acc-quadtree2');

  const diagnosticsCanvas = document.getElementById('diagnostics-canvas');
  const diagnosticsCtx = diagnosticsCanvas ? diagnosticsCanvas.getContext('2d') : null;
  const diagResidualVal = document.getElementById('diag-residual-val');
  const diagLatencyVal = document.getElementById('diag-latency-val');

  const radarCanvas = document.getElementById('radar-canvas');
  const radarCtx = radarCanvas ? radarCanvas.getContext('2d') : null;

  const smartLiveCanvas = document.getElementById('smart-live-canvas');
  const smartLiveCtx = smartLiveCanvas ? smartLiveCanvas.getContext('2d') : null;
  const ringCpuText = document.getElementById('ring-cpu-text');
  const ringCpuFg = document.getElementById('ring-cpu-fg');
  const ringMemText = document.getElementById('ring-mem-text');
  const ringMemFg = document.getElementById('ring-mem-fg');
  const ringDriftText = document.getElementById('ring-drift-text');
  const ringDriftFg = document.getElementById('ring-drift-fg');

  const bannerPlayBtn = document.getElementById('banner-play-btn');
  const bannerFsBtn = document.getElementById('banner-fs-btn');

  // Sliders in Card 1
  if (sliderDensity && valDensity) {
    sliderDensity.addEventListener('input', (e) => {
      const v = e.target.value;
      valDensity.textContent = `${v}%`;
    });
  }

  if (sliderBandwidth && valBandwidth) {
    sliderBandwidth.addEventListener('input', (e) => {
      const v = e.target.value;
      valBandwidth.textContent = `${v}%`;
    });
  }

  if (sliderLatency && valLatency) {
    sliderLatency.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value).toFixed(1);
      valLatency.textContent = `${v}%`;
      actualLatencyMs = (v * 0.9).toFixed(1);
      if (diagLatencyVal) {
        diagLatencyVal.textContent = `${(actualLatencyMs * 0.32).toFixed(2)} ms`;
      }
    });
  }

  // Accordions in Card 2
  [accGhost, accQuadtree1, accQuadtree2].forEach(item => {
    if (!item) return;
    const header = item.querySelector('.accordion-header');
    const content = item.querySelector('.accordion-content');
    if (header && content) {
      header.addEventListener('click', () => {
        const isOpen = item.classList.contains('active');
        if (isOpen) {
          item.classList.remove('active');
          content.classList.add('hidden');
        } else {
          item.classList.add('active');
          content.classList.remove('hidden');
        }
        playClickSound(800, 'sine', 0.04);
      });
    }
  });

  // Bottom Banner actions
  if (bannerPlayBtn) {
    bannerPlayBtn.addEventListener('click', () => {
      btnToggleScan.click();
    });
  }

  if (bannerFsBtn) {
    bannerFsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        bannerFsBtn.textContent = '✕';
      } else {
        document.exitFullscreen().catch(() => {});
        bannerFsBtn.textContent = '⛶';
      }
      playClickSound(850, 'sine', 0.05);
    });
  }

  // Card 4: Evaluation Benchmark Table Row Clicks
  const benchTable = document.querySelector('.benchmark-data-table');
  if (benchTable) {
    benchTable.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (tr && !tr.closest('thead')) {
        playClickSound(950, 'sine', 0.04);
        if (tr.classList.contains('highlight-row')) {
          showToast('Spatial Sentinel: 3.076 MB vs 31.25 MB baseline (-90.1% memory saving)', '🚀');
        } else {
          showToast(`Row benchmark: ${tr.cells[0]?.textContent || ''} MB / ${tr.cells[3]?.textContent || ''} latency`, '📊');
        }
      }
    });
  }

  // ─── Canvases Animation State & Renderers ─────────────────────────────────

  // 1. LiDAR Ray Stream (Card 1)
  const lidarPoints = 50;
  const lidarStreamData = [];
  for (let i = 0; i < lidarPoints; i++) {
    lidarStreamData.push(700 + Math.sin(i * 0.35) * 450 + Math.cos(i * 0.8) * 300);
  }
  let lastLidarTick = 0;

  function updateLidarStream(timestamp) {
    if (!isScanning) return;
    if (timestamp - lastLidarTick < 40) return;
    lastLidarTick = timestamp;

    const density = sliderDensity ? parseInt(sliderDensity.value, 10) / 100 : 0.65;
    const bandwidth = sliderBandwidth ? parseInt(sliderBandwidth.value, 10) / 100 : 1.0;
    const baseRay = 1100 * density * bandwidth;
    const noise = (Math.random() - 0.5) * 200 * density;
    const wave = Math.sin(timestamp * 0.003) * 600 * density + Math.cos(timestamp * 0.007) * 400 * density;
    const val = Math.max(120, Math.min(2450, baseRay + wave + noise));

    lidarStreamData.shift();
    lidarStreamData.push(val);
  }

  function renderLidarStreamChart(timestamp) {
    if (!lidarStreamCtx || !lidarStreamCanvas) return;
    updateLidarStream(timestamp);

    const w = lidarStreamCanvas.width;
    const h = lidarStreamCanvas.height;
    lidarStreamCtx.clearRect(0, 0, w, h);

    // Horizontal grid lines (500 to 2500)
    lidarStreamCtx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    lidarStreamCtx.lineWidth = 1;
    lidarStreamCtx.setLineDash([3, 4]);

    for (let r = 500; r <= 2500; r += 500) {
      const y = h - (r / 2600) * (h - 20) - 8;
      lidarStreamCtx.beginPath();
      lidarStreamCtx.moveTo(0, y);
      lidarStreamCtx.lineTo(w, y);
      lidarStreamCtx.stroke();
    }
    lidarStreamCtx.setLineDash([]);

    // Draw Filled Area Curve
    lidarStreamCtx.beginPath();
    lidarStreamCtx.moveTo(0, h);

    const len = lidarStreamData.length;
    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * w;
      const y = h - (lidarStreamData[i] / 2600) * (h - 20) - 8;
      if (i === 0) lidarStreamCtx.lineTo(x, y);
      else {
        const prevX = ((i - 1) / (len - 1)) * w;
        const prevY = h - (lidarStreamData[i - 1] / 2600) * (h - 20) - 8;
        const mx = (prevX + x) / 2;
        lidarStreamCtx.quadraticCurveTo(prevX, prevY, mx, (prevY + y) / 2);
      }
    }
    lidarStreamCtx.lineTo(w, h);
    lidarStreamCtx.closePath();

    const grad = lidarStreamCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(6, 182, 212, 0.38)');
    grad.addColorStop(0.6, 'rgba(6, 182, 212, 0.12)');
    grad.addColorStop(1, 'rgba(6, 182, 212, 0.01)');
    lidarStreamCtx.fillStyle = grad;
    lidarStreamCtx.fill();

    // Line Stroke with Cyan Glow
    lidarStreamCtx.beginPath();
    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * w;
      const y = h - (lidarStreamData[i] / 2600) * (h - 20) - 8;
      if (i === 0) lidarStreamCtx.moveTo(x, y);
      else {
        const prevX = ((i - 1) / (len - 1)) * w;
        const prevY = h - (lidarStreamData[i - 1] / 2600) * (h - 20) - 8;
        const mx = (prevX + x) / 2;
        lidarStreamCtx.quadraticCurveTo(prevX, prevY, mx, (prevY + y) / 2);
      }
    }
    lidarStreamCtx.shadowColor = '#06b6d4';
    lidarStreamCtx.shadowBlur = 8;
    lidarStreamCtx.strokeStyle = '#22d3ee';
    lidarStreamCtx.lineWidth = 2;
    lidarStreamCtx.stroke();
    lidarStreamCtx.shadowBlur = 0;

    // Glowing leading apex
    const lastX = w;
    const lastY = h - (lidarStreamData[len - 1] / 2600) * (h - 20) - 8;
    lidarStreamCtx.fillStyle = '#ffffff';
    lidarStreamCtx.beginPath();
    lidarStreamCtx.arc(lastX - 2, lastY, 3, 0, Math.PI * 2);
    lidarStreamCtx.fill();
  }

  // 2. Diagnostics Waveform (Card 3)
  const diagPoints = 60;
  const diagData = [];
  for (let i = 0; i < diagPoints; i++) {
    diagData.push(Math.sin(i * 0.4) * 15 + Math.cos(i * 1.1) * 8);
  }
  let lastDiagTick = 0;

  function updateDiagnostics(timestamp) {
    if (!isScanning) return;
    if (timestamp - lastDiagTick < 35) return;
    lastDiagTick = timestamp;

    const base = Math.sin(timestamp * 0.008) * 14 + Math.cos(timestamp * 0.015) * 8;
    const noise = (Math.random() - 0.5) * 6;
    const motionSpike = (currentScenario === 'doorway' || currentScenario === 'chair') ? (Math.random() > 0.85 ? 22 : 0) : 0;
    diagData.shift();
    diagData.push(base + noise + motionSpike);

    // Update dual metrics text with slight micro-variations
    if (diagResidualVal) {
      const res = (2.45 + Math.sin(timestamp * 0.002) * 0.04).toFixed(2);
      diagResidualVal.textContent = `${res}%`;
    }
    if (diagLatencyVal) {
      const lat = (1.15 + Math.cos(timestamp * 0.003) * 0.03).toFixed(2);
      diagLatencyVal.textContent = `${lat} ms`;
    }
  }

  function renderDiagnosticsChart(timestamp) {
    if (!diagnosticsCtx || !diagnosticsCanvas) return;
    updateDiagnostics(timestamp);

    const w = diagnosticsCanvas.width;
    const h = diagnosticsCanvas.height;
    diagnosticsCtx.clearRect(0, 0, w, h);

    const midY = h / 2;

    // Baseline
    diagnosticsCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    diagnosticsCtx.lineWidth = 1;
    diagnosticsCtx.beginPath();
    diagnosticsCtx.moveTo(0, midY);
    diagnosticsCtx.lineTo(w, midY);
    diagnosticsCtx.stroke();

    // Waveform
    diagnosticsCtx.beginPath();
    const len = diagData.length;
    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * w;
      const y = midY - diagData[i];
      if (i === 0) diagnosticsCtx.moveTo(x, y);
      else diagnosticsCtx.lineTo(x, y);
    }
    diagnosticsCtx.shadowColor = '#06b6d4';
    diagnosticsCtx.shadowBlur = 6;
    diagnosticsCtx.strokeStyle = '#06b6d4';
    diagnosticsCtx.lineWidth = 1.8;
    diagnosticsCtx.stroke();
    diagnosticsCtx.shadowBlur = 0;

    // Highlights for peaks
    for (let i = 2; i < len - 2; i += 8) {
      if (Math.abs(diagData[i]) > 14) {
        const x = (i / (len - 1)) * w;
        const y = midY - diagData[i];
        diagnosticsCtx.fillStyle = diagData[i] > 18 ? '#f97316' : '#22d3ee';
        diagnosticsCtx.beginPath();
        diagnosticsCtx.arc(x, y, 2.5, 0, Math.PI * 2);
        diagnosticsCtx.fill();
      }
    }
  }

  // 3. Multi-Axis Radar / Spider Chart (Card 5)
  const radarAxes = [
    { label: 'Resolution (2.5D)', val: 0.92, text: 'Res 92%' },
    { label: 'Kernel Latency', val: 0.96, text: 'Lat 0.39ms' },
    { label: 'Dynamic Sep', val: 0.88, text: 'Dyn Sep 88%' },
    { label: 'Memory Eff', val: 0.95, text: 'Mem 3.1KB' },
    { label: 'Accuracy', val: 0.90, text: 'Acc 98%' }
  ];

  function renderRadarSpiderChart(timestamp) {
    if (!radarCtx || !radarCanvas) return;
    const w = radarCanvas.width;
    const h = radarCanvas.height;
    radarCtx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2 + 6;
    const maxRadius = 66;
    const sides = 5;
    const angleStep = (Math.PI * 2) / sides;
    const startAngle = -Math.PI / 2;

    // Draw concentric web pentagons (25%, 50%, 75%, 100%)
    const rings = [0.25, 0.5, 0.75, 1.0];
    rings.forEach((level) => {
      radarCtx.beginPath();
      for (let s = 0; s < sides; s++) {
        const ang = startAngle + s * angleStep;
        const r = maxRadius * level;
        const px = cx + Math.cos(ang) * r;
        const py = cy + Math.sin(ang) * r;
        if (s === 0) radarCtx.moveTo(px, py);
        else radarCtx.lineTo(px, py);
      }
      radarCtx.closePath();
      radarCtx.strokeStyle = level === 1.0 ? 'rgba(6, 182, 212, 0.28)' : 'rgba(255, 255, 255, 0.08)';
      radarCtx.lineWidth = 1;
      radarCtx.stroke();
    });

    // Draw radial spokes & labels
    for (let s = 0; s < sides; s++) {
      const ang = startAngle + s * angleStep;
      const px = cx + Math.cos(ang) * maxRadius;
      const py = cy + Math.sin(ang) * maxRadius;
      radarCtx.beginPath();
      radarCtx.moveTo(cx, cy);
      radarCtx.lineTo(px, py);
      radarCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      radarCtx.lineWidth = 1;
      radarCtx.stroke();

      const labelDist = maxRadius + 18;
      const lx = cx + Math.cos(ang) * labelDist;
      const ly = cy + Math.sin(ang) * labelDist + 3;
      radarCtx.fillStyle = '#94a3b8';
      radarCtx.font = '9px "JetBrains Mono", monospace';
      radarCtx.textAlign = 'center';
      radarCtx.fillText(radarAxes[s].text, lx, ly);
    }

    // Draw Data Polygon with slight breathing animation
    const breath = isScanning ? Math.sin(timestamp * 0.0025) * 0.015 : 0;
    radarCtx.beginPath();
    const polyPoints = [];
    for (let s = 0; s < sides; s++) {
      const ang = startAngle + s * angleStep;
      const val = Math.min(1.0, radarAxes[s].val + breath + Math.sin(timestamp * 0.003 + s) * 0.01);
      const r = maxRadius * val;
      const px = cx + Math.cos(ang) * r;
      const py = cy + Math.sin(ang) * r;
      polyPoints.push({ x: px, y: py });
      if (s === 0) radarCtx.moveTo(px, py);
      else radarCtx.lineTo(px, py);
    }
    radarCtx.closePath();

    const polyGrad = radarCtx.createRadialGradient(cx, cy, 5, cx, cy, maxRadius);
    polyGrad.addColorStop(0, 'rgba(6, 182, 212, 0.38)');
    polyGrad.addColorStop(1, 'rgba(6, 182, 212, 0.08)');
    radarCtx.fillStyle = polyGrad;
    radarCtx.fill();

    radarCtx.shadowColor = '#22d3ee';
    radarCtx.shadowBlur = 10;
    radarCtx.strokeStyle = '#22d3ee';
    radarCtx.lineWidth = 2;
    radarCtx.stroke();
    radarCtx.shadowBlur = 0;

    polyPoints.forEach(pt => {
      radarCtx.fillStyle = '#ffffff';
      radarCtx.beginPath();
      radarCtx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      radarCtx.fill();

      radarCtx.strokeStyle = '#06b6d4';
      radarCtx.lineWidth = 1.5;
      radarCtx.stroke();
    });
  }

  // 4. Smart Live Stream Sparkline & Resource Gauges (Card 6)
  const smartPoints = 50;
  const smartLiveData = [];
  for (let i = 0; i < smartPoints; i++) {
    smartLiveData.push(Math.sin(i * 0.5) * 12 + Math.cos(i * 1.2) * 8);
  }
  let lastSmartTick = 0;

  function updateSmartLive(timestamp) {
    if (!isScanning) return;
    if (timestamp - lastSmartTick < 40) return;
    lastSmartTick = timestamp;

    const base = Math.sin(timestamp * 0.006) * 14 + Math.cos(timestamp * 0.012) * 10;
    const noise = (Math.random() - 0.5) * 5;
    smartLiveData.shift();
    smartLiveData.push(base + noise);

    // Micro-update progress rings
    if (ringCpuText) {
      const cpu = Math.round(29 + Math.sin(timestamp * 0.001) * 3);
      ringCpuText.textContent = `${cpu}%`;
      if (ringCpuFg) ringCpuFg.style.strokeDashoffset = (138.2 * (1 - cpu / 100)).toFixed(1);
    }
    if (ringMemText) {
      const mem = Math.round(65 + Math.cos(timestamp * 0.0015) * 2);
      ringMemText.textContent = `${mem}%`;
      if (ringMemFg) ringMemFg.style.strokeDashoffset = (138.2 * (1 - mem / 100)).toFixed(1);
    }
    if (ringDriftText) {
      const drift = Math.round(5 + Math.sin(timestamp * 0.002) * 1);
      ringDriftText.textContent = `${drift}%`;
      if (ringDriftFg) ringDriftFg.style.strokeDashoffset = (138.2 * (1 - drift / 100)).toFixed(1);
    }
  }

  function renderSmartLiveStream(timestamp) {
    if (!smartLiveCtx || !smartLiveCanvas) return;
    updateSmartLive(timestamp);

    const w = smartLiveCanvas.width;
    const h = smartLiveCanvas.height;
    smartLiveCtx.clearRect(0, 0, w, h);

    const midY = h / 2;

    // Background dashed line
    smartLiveCtx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    smartLiveCtx.lineWidth = 1;
    smartLiveCtx.beginPath();
    smartLiveCtx.moveTo(0, midY);
    smartLiveCtx.lineTo(w, midY);
    smartLiveCtx.stroke();

    // Stream line
    smartLiveCtx.beginPath();
    const len = smartLiveData.length;
    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * w;
      const y = midY - smartLiveData[i];
      if (i === 0) smartLiveCtx.moveTo(x, y);
      else smartLiveCtx.lineTo(x, y);
    }

    smartLiveCtx.shadowColor = '#10b981';
    smartLiveCtx.shadowBlur = 8;
    smartLiveCtx.strokeStyle = '#10b981';
    smartLiveCtx.lineWidth = 1.8;
    smartLiveCtx.stroke();
    smartLiveCtx.shadowBlur = 0;

    // Leading apex pulse
    const lx = w - 2;
    const ly = midY - smartLiveData[len - 1];
    smartLiveCtx.fillStyle = '#ffffff';
    smartLiveCtx.beginPath();
    smartLiveCtx.arc(lx, ly, 3, 0, Math.PI * 2);
    smartLiveCtx.fill();
  }

  // Combined render call for all 4 Station canvases
  function renderStationCanvases(timestamp) {
    renderLidarStreamChart(timestamp);
    renderDiagnosticsChart(timestamp);
    renderRadarSpiderChart(timestamp);
    renderSmartLiveStream(timestamp);
  }

  // ─── Modal Handling ────────────────────────────────────────────────────────
  const btnOpenGuide = document.getElementById('btn-open-guide');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const guideModal = document.getElementById('guide-modal');

  btnOpenGuide.addEventListener('click', () => {
    guideModal.classList.remove('hidden');
    playClickSound(800, 'sine', 0.05);
  });

  btnCloseModal.addEventListener('click', () => {
    guideModal.classList.add('hidden');
  });

  guideModal.addEventListener('click', (e) => {
    if (e.target === guideModal) guideModal.classList.add('hidden');
  });

  document.getElementById('btn-clear-logs').addEventListener('click', () => {
    auditLogs.innerHTML = '';
    playClickSound(600, 'sine', 0.04);
  });

  // ─── Export Actions ────────────────────────────────────────────────────────
  document.getElementById('btn-export-json').addEventListener('click', () => {
    const data = {
      product: 'Spatial Sentinel',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      scenario: currentScenario,
      confidence: confidenceVal,
      budget: {
        memoryKB: actualMemoryKB,
        latencyMs: actualLatencyMs,
        rmseCm: actualRmseCm
      },
      grid: {
        columns: COLS,
        rows: ROWS,
        cells: cells
      }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spatial_sentinel_map_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported 2.5D spatial map to JSON', '💾');
    appendLog('EXPORT', 'JSON map data serialized and downloaded.', 'green');
  });

  document.getElementById('btn-export-csv').addEventListener('click', () => {
    let csv = 'Column,Row,Kind,Height_M,Confidence_Pct,Semantic\n';
    cells.forEach(c => {
      csv += `${c.col},${c.row},${c.kind},${c.height},${c.confidence},"${c.semantic}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spatial_sentinel_cells_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported cell matrix to CSV', '📊');
    appendLog('EXPORT', 'CSV elevation matrix generated.', 'green');
  });

  // ─── Link-Only Access Gate (Enforces Link-Only Access) ────────────────────
  const lockGate = document.getElementById('lock-gate');
  const lockForm = document.getElementById('lock-form');
  const gatePasscode = document.getElementById('gate-passcode');
  const lockError = document.getElementById('lock-error');
  const btnShareLink = document.getElementById('btn-share-link');

  const SECRET_ACCESS_KEY = 'sentinel2026';
  const urlParams = new URLSearchParams(window.location.search);
  const keyParam = urlParams.get('key');

  if (keyParam === SECRET_ACCESS_KEY || sessionStorage.getItem('sentinel_auth') === 'true') {
    sessionStorage.setItem('sentinel_auth', 'true');
    lockGate.classList.add('hidden');
  } else {
    lockGate.classList.remove('hidden');
  }

  if (lockForm) {
    lockForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = gatePasscode.value.trim();
      if (val === SECRET_ACCESS_KEY) {
        sessionStorage.setItem('sentinel_auth', 'true');
        lockGate.classList.add('hidden');
        playClickSound(1080, 'sine', 0.12);
        showToast('Access Granted: Welcome to Spatial Sentinel', '🔓');
        appendLog('AUTH', 'Session authenticated via access key.', 'green');
      } else {
        lockError.classList.remove('hidden');
        playClickSound(300, 'sawtooth', 0.2);
        gatePasscode.style.borderColor = '#ef4444';
        setTimeout(() => gatePasscode.style.borderColor = '', 1500);
      }
    });
  }

  if (btnShareLink) {
    btnShareLink.addEventListener('click', () => {
      const shareUrl = `${window.location.origin}${window.location.pathname}?key=${SECRET_ACCESS_KEY}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        playClickSound(1000, 'sine', 0.08);
        showToast('Authorized link copied! Anyone with this link gets instant access.', '📋');
        appendLog('SHARE', 'Copied secure link with ?key=sentinel2026 to clipboard.', 'cyan');
      }).catch(() => {
        prompt('Copy your secure link to share:', shareUrl);
      });
    });
  }

  appendLog('INIT', 'Spatial Sentinel Engine initialized. Canvas 600x360.', 'green');
  appendLog('BUDGET', 'Budget Governor active: Target 45 KB / 3.6 ms (Jetson Orin Nano).', 'cyan');

})();

