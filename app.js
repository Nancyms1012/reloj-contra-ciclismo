/* ============================================
   CRONO CONTRARRELOJ - App Logic
   Reloj digital para lanzamientos CRI/CRE
   ============================================ */

// ==================== Estado de la aplicacion ====================
const state = {
    mode: 'setup', // setup | running | results
    raceType: 'individual', // individual | team
    interval: 60, // segundos entre lanzamientos
    startTime: null, // hora del primer lanzamiento (Date)
    alarmSeconds: 10, // segundos antes para avisar
    soundEnabled: true,
    riders: [], // lista de corredores [{number, name, team}]
    launched: [], // corredores ya lanzados [{...rider, launchTime, skipped}]
    currentIndex: 0, // indice del proximo corredor a lanzar
    isRunning: false,
    isPaused: false,
    alertTimeout: null,
    audioContext: null,
};

// ==================== Elementos del DOM ====================
const elements = {
    // Reloj
    clockHours: document.getElementById('clock-hours'),
    clockMinutes: document.getElementById('clock-minutes'),
    clockSeconds: document.getElementById('clock-seconds'),
    clockMs: document.getElementById('clock-ms'),
    clockDate: document.getElementById('clock-date'),
    
    // Countdown
    countdownSection: document.getElementById('countdown-section'),
    countdownDisplay: document.getElementById('countdown-display'),
    countdownMin: document.getElementById('countdown-min'),
    countdownSec: document.getElementById('countdown-sec'),
    countdownRider: document.getElementById('countdown-rider'),
    
    // Alert
    launchAlert: document.getElementById('launch-alert'),
    alertRiderName: document.getElementById('alert-rider-name'),
    alertRiderNumber: document.getElementById('alert-rider-number'),
    
    // Navigation
    modeButtons: document.querySelectorAll('.mode-btn'),
    
    // Setup
    panelSetup: document.getElementById('panel-setup'),
    panelRunning: document.getElementById('panel-running'),
    panelResults: document.getElementById('panel-results'),
    intervalMin: document.getElementById('interval-min'),
    intervalSec: document.getElementById('interval-sec'),
    startHour: document.getElementById('start-hour'),
    startMin: document.getElementById('start-min'),
    startSec: document.getElementById('start-sec'),
    riderNumber: document.getElementById('rider-number'),
    riderName: document.getElementById('rider-name'),
    riderTeam: document.getElementById('rider-team'),
    ridersList: document.getElementById('riders-list'),
    riderCount: document.getElementById('rider-count'),
    alarmSecondsInput: document.getElementById('alarm-seconds'),
    alarmSoundCheckbox: document.getElementById('alarm-sound'),
    ridersTitle: document.getElementById('riders-title'),
    
    // Running
    currentRider: document.getElementById('current-rider'),
    nextRider: document.getElementById('next-rider'),
    launchedCount: document.getElementById('launched-count'),
    pendingCount: document.getElementById('pending-count'),
    upcomingList: document.getElementById('upcoming-list'),
    
    // Results
    resultsList: document.getElementById('results-list'),
    
    // Buttons
    btnFullscreen: document.getElementById('btn-fullscreen'),
    btnAddRider: document.getElementById('btn-add-rider'),
    btnClearRiders: document.getElementById('btn-clear-riders'),
    btnStartRace: document.getElementById('btn-start-race'),
    btnManualLaunch: document.getElementById('btn-manual-launch'),
    btnSkipRider: document.getElementById('btn-skip-rider'),
    btnPauseRace: document.getElementById('btn-pause-race'),
    btnStopRace: document.getElementById('btn-stop-race'),
    btnExport: document.getElementById('btn-export'),
};

// ==================== Inicializacion ====================
function init() {
    // Configurar hora actual para inicio
    const now = new Date();
    elements.startHour.value = now.getHours();
    elements.startMin.value = now.getMinutes() + 5;
    if (parseInt(elements.startMin.value) >= 60) {
        elements.startMin.value = 0;
        elements.startHour.value = parseInt(elements.startHour.value) + 1;
    }
    
    // Event listeners
    setupEventListeners();
    
    // Iniciar reloj
    updateClock();
    setInterval(updateClock, 50); // Actualizar cada 50ms para milisegundos
    
    // Iniciar loop de countdown
    setInterval(updateCountdown, 100);
}

function setupEventListeners() {
    // Fullscreen
    elements.btnFullscreen.addEventListener('click', toggleFullscreen);
    
    // Mode navigation
    elements.modeButtons.forEach(btn => {
        btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });
    
    // Race type
    document.querySelectorAll('input[name="tt-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.raceType = e.target.value;
            elements.ridersTitle.textContent = state.raceType === 'team' ? 'Equipos' : 'Corredores';
        });
    });
    
    // Interval presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const seconds = parseInt(btn.dataset.interval);
            elements.intervalMin.value = Math.floor(seconds / 60);
            elements.intervalSec.value = seconds % 60;
        });
    });
    
    // Interval inputs update presets
    elements.intervalMin.addEventListener('change', updatePresetHighlight);
    elements.intervalSec.addEventListener('change', updatePresetHighlight);
    
    // Add rider
    elements.btnAddRider.addEventListener('click', addRider);
    elements.riderName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addRider();
    });
    elements.riderTeam.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addRider();
    });
    
    // Clear riders
    elements.btnClearRiders.addEventListener('click', () => {
        if (confirm('¿Limpiar toda la lista de corredores?')) {
            state.riders = [];
            renderRidersList();
        }
    });
    
    // Start race
    elements.btnStartRace.addEventListener('click', startRace);
    
    // Running controls
    elements.btnManualLaunch.addEventListener('click', manualLaunch);
    elements.btnSkipRider.addEventListener('click', skipRider);
    elements.btnPauseRace.addEventListener('click', togglePause);
    elements.btnStopRace.addEventListener('click', stopRace);
    
    // Export
    elements.btnExport.addEventListener('click', exportCSV);
}

// ==================== Reloj Digital ====================
function updateClock() {
    const now = new Date();
    elements.clockHours.textContent = padZero(now.getHours());
    elements.clockMinutes.textContent = padZero(now.getMinutes());
    elements.clockSeconds.textContent = padZero(now.getSeconds());
    elements.clockMs.textContent = '.' + padZero(Math.floor(now.getMilliseconds() / 10));
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    elements.clockDate.textContent = now.toLocaleDateString('es-ES', options);
}

// ==================== Countdown ====================
function updateCountdown() {
    if (!state.isRunning || state.isPaused) return;
    
    const now = new Date();
    const nextLaunchTime = getNextLaunchTime();
    
    if (!nextLaunchTime) {
        elements.countdownSection.classList.add('hidden');
        return;
    }
    
    const diff = nextLaunchTime.getTime() - now.getTime();
    
    if (diff <= 0) {
        // Es hora del lanzamiento!
        triggerLaunch();
        return;
    }
    
    elements.countdownSection.classList.remove('hidden');
    
    const totalSeconds = Math.ceil(diff / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    elements.countdownMin.textContent = padZero(minutes);
    elements.countdownSec.textContent = padZero(seconds);
    
    // Mostrar corredor siguiente
    const nextRiderData = state.riders[state.currentIndex];
    if (nextRiderData) {
        const label = state.raceType === 'team' ? 'Equipo' : 'Dorsal';
        elements.countdownRider.textContent = `${label} #${nextRiderData.number} - ${nextRiderData.name}`;
    }
    
    // Alarma pre-lanzamiento
    if (totalSeconds <= state.alarmSeconds) {
        elements.countdownSection.classList.add('warning');
        if (totalSeconds <= state.alarmSeconds && totalSeconds > state.alarmSeconds - 1) {
            playBeep('warning');
        }
        // Beep cada segundo en los ultimos 5
        if (totalSeconds <= 5 && seconds !== 0) {
            playBeep('tick');
        }
    } else {
        elements.countdownSection.classList.remove('warning');
    }
}

function getNextLaunchTime() {
    if (state.currentIndex >= state.riders.length) return null;
    
    const launchTime = new Date(state.startTime.getTime());
    launchTime.setSeconds(launchTime.getSeconds() + (state.currentIndex * state.interval));
    return launchTime;
}

// ==================== Lanzamiento ====================
function triggerLaunch() {
    if (state.currentIndex >= state.riders.length) {
        finishRace();
        return;
    }
    
    const rider = state.riders[state.currentIndex];
    const now = new Date();
    
    // Registrar lanzamiento
    state.launched.push({
        ...rider,
        launchTime: now,
        scheduledTime: getNextLaunchTime(),
        skipped: false,
        order: state.launched.length + 1
    });
    
    // Mostrar alerta
    showLaunchAlert(rider);
    
    // Sonido de lanzamiento
    playBeep('launch');
    
    // Avanzar al siguiente
    state.currentIndex++;
    
    // Actualizar UI
    updateRunningPanel();
    updateResultsPanel();
    
    // Verificar si terminamos
    if (state.currentIndex >= state.riders.length) {
        setTimeout(() => finishRace(), 3000);
    }
}

function showLaunchAlert(rider) {
    elements.alertRiderName.textContent = rider.name;
    elements.alertRiderNumber.textContent = `#${rider.number}`;
    elements.launchAlert.classList.remove('hidden');
    
    // Ocultar despues de 3 segundos
    if (state.alertTimeout) clearTimeout(state.alertTimeout);
    state.alertTimeout = setTimeout(() => {
        elements.launchAlert.classList.add('hidden');
    }, 3000);
}

function manualLaunch() {
    if (state.currentIndex >= state.riders.length) return;
    triggerLaunch();
}

function skipRider() {
    if (state.currentIndex >= state.riders.length) return;
    
    const rider = state.riders[state.currentIndex];
    state.launched.push({
        ...rider,
        launchTime: new Date(),
        scheduledTime: getNextLaunchTime(),
        skipped: true,
        order: state.launched.length + 1
    });
    
    state.currentIndex++;
    updateRunningPanel();
    updateResultsPanel();
    
    if (state.currentIndex >= state.riders.length) {
        setTimeout(() => finishRace(), 1000);
    }
}

// ==================== Control de Carrera ====================
function startRace() {
    // Validaciones
    if (state.riders.length === 0) {
        alert('Agrega al menos un corredor/equipo antes de iniciar.');
        return;
    }
    
    // Configurar intervalo
    state.interval = (parseInt(elements.intervalMin.value) || 0) * 60 + (parseInt(elements.intervalSec.value) || 0);
    if (state.interval < 10) {
        alert('El intervalo minimo es de 10 segundos.');
        return;
    }
    
    // Configurar hora de inicio
    const now = new Date();
    state.startTime = new Date(now);
    state.startTime.setHours(parseInt(elements.startHour.value) || 0);
    state.startTime.setMinutes(parseInt(elements.startMin.value) || 0);
    state.startTime.setSeconds(parseInt(elements.startSec.value) || 0);
    state.startTime.setMilliseconds(0);
    
    // Si la hora ya paso, usar proxima oportunidad
    if (state.startTime.getTime() < now.getTime()) {
        const confirm_past = confirm('La hora de inicio ya paso. ¿Deseas iniciar en 30 segundos desde ahora?');
        if (confirm_past) {
            state.startTime = new Date(now.getTime() + 30000);
            state.startTime.setMilliseconds(0);
        } else {
            return;
        }
    }
    
    // Configurar alarma
    state.alarmSeconds = parseInt(elements.alarmSecondsInput.value) || 10;
    state.soundEnabled = elements.alarmSoundCheckbox.checked;
    
    // Iniciar
    state.isRunning = true;
    state.isPaused = false;
    state.currentIndex = 0;
    state.launched = [];
    
    // Inicializar audio context
    initAudio();
    
    // Cambiar a modo running
    switchMode('running');
    updateRunningPanel();
}

function togglePause() {
    state.isPaused = !state.isPaused;
    elements.btnPauseRace.textContent = state.isPaused ? 'REANUDAR' : 'PAUSAR';
    elements.btnPauseRace.classList.toggle('btn-warning');
    elements.btnPauseRace.classList.toggle('btn-start');
    
    if (state.isPaused) {
        elements.countdownSection.classList.add('hidden');
    }
}

function stopRace() {
    if (!confirm('¿Detener la contrarreloj? Se conservaran los registros de salida.')) return;
    
    state.isRunning = false;
    state.isPaused = false;
    elements.countdownSection.classList.add('hidden');
    elements.launchAlert.classList.add('hidden');
    
    switchMode('results');
    updateResultsPanel();
}

function finishRace() {
    state.isRunning = false;
    elements.countdownSection.classList.add('hidden');
    
    switchMode('results');
    updateResultsPanel();
    alert('¡Contrarreloj finalizada! Todos los corredores han sido lanzados.');
}

// ==================== Gestion de Corredores ====================
function addRider() {
    const number = elements.riderNumber.value.trim();
    const name = elements.riderName.value.trim();
    const team = elements.riderTeam.value.trim();
    
    if (!number || !name) {
        alert('Ingresa al menos el dorsal y el nombre.');
        return;
    }
    
    // Verificar dorsal duplicado
    if (state.riders.some(r => r.number === number)) {
        alert('Ya existe un corredor con ese dorsal.');
        return;
    }
    
    state.riders.push({ number, name, team });
    
    // Limpiar inputs
    elements.riderNumber.value = '';
    elements.riderName.value = '';
    elements.riderTeam.value = '';
    elements.riderNumber.focus();
    
    renderRidersList();
}

function removeRider(index) {
    state.riders.splice(index, 1);
    renderRidersList();
}

function renderRidersList() {
    const interval = (parseInt(elements.intervalMin.value) || 0) * 60 + (parseInt(elements.intervalSec.value) || 0);
    
    elements.ridersList.innerHTML = state.riders.map((rider, index) => {
        const estimatedTime = calculateLaunchTime(index, interval);
        return `
            <div class="rider-item">
                <span class="rider-num">#${rider.number}</span>
                <div class="rider-info">
                    <div class="name">${rider.name}</div>
                    ${rider.team ? `<div class="team">${rider.team}</div>` : ''}
                </div>
                <span class="rider-time">${estimatedTime}</span>
                <button class="btn-remove" onclick="removeRider(${index})">&#10005;</button>
            </div>
        `;
    }).join('');
    
    elements.riderCount.textContent = `${state.riders.length} ${state.raceType === 'team' ? 'equipos' : 'corredores'}`;
}

function calculateLaunchTime(index, interval) {
    const startH = parseInt(elements.startHour.value) || 0;
    const startM = parseInt(elements.startMin.value) || 0;
    const startS = parseInt(elements.startSec.value) || 0;
    
    const totalSeconds = startH * 3600 + startM * 60 + startS + (index * interval);
    const h = Math.floor(totalSeconds / 3600) % 24;
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    return `${padZero(h)}:${padZero(m)}:${padZero(s)}`;
}

// ==================== Actualizacion de Paneles ====================
function updateRunningPanel() {
    const currentRider = state.riders[state.currentIndex];
    const nextRider = state.riders[state.currentIndex + 1];
    
    elements.currentRider.textContent = currentRider ? `#${currentRider.number} ${currentRider.name}` : 'Finalizado';
    elements.nextRider.textContent = nextRider ? `#${nextRider.number} ${nextRider.name}` : '-';
    elements.launchedCount.textContent = state.launched.length;
    elements.pendingCount.textContent = state.riders.length - state.currentIndex;
    
    // Proximos lanzamientos
    const upcoming = [];
    for (let i = state.currentIndex; i < Math.min(state.currentIndex + 5, state.riders.length); i++) {
        const rider = state.riders[i];
        const launchTime = new Date(state.startTime.getTime() + (i * state.interval * 1000));
        upcoming.push({
            rider,
            time: launchTime
        });
    }
    
    elements.upcomingList.innerHTML = upcoming.map(item => `
        <div class="upcoming-item">
            <span class="up-time">${formatTime(item.time)}</span>
            <span class="up-number">#${item.rider.number}</span>
            <span class="up-name">${item.rider.name}</span>
        </div>
    `).join('');
}

function updateResultsPanel() {
    elements.resultsList.innerHTML = state.launched.map(record => `
        <div class="result-item ${record.skipped ? 'skipped' : ''}">
            <span class="res-order">${record.order}</span>
            <span class="res-number">#${record.number}</span>
            <span class="res-name">${record.name}${record.team ? ` (${record.team})` : ''}</span>
            <span class="res-time">${record.skipped ? 'SALTADO' : formatTime(record.launchTime)}</span>
        </div>
    `).join('');
}

// ==================== Navegacion de Modos ====================
function switchMode(mode) {
    state.mode = mode;
    
    elements.modeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    elements.panelSetup.classList.toggle('active', mode === 'setup');
    elements.panelRunning.classList.toggle('active', mode === 'running');
    elements.panelResults.classList.toggle('active', mode === 'results');
}

// ==================== Audio ====================
function initAudio() {
    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.warn('Audio no disponible:', e);
    }
}

function playBeep(type) {
    if (!state.soundEnabled || !state.audioContext) return;
    
    try {
        const oscillator = state.audioContext.createOscillator();
        const gainNode = state.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(state.audioContext.destination);
        
        switch (type) {
            case 'warning':
                oscillator.frequency.value = 800;
                gainNode.gain.value = 0.3;
                oscillator.type = 'sine';
                oscillator.start();
                oscillator.stop(state.audioContext.currentTime + 0.2);
                break;
            case 'tick':
                oscillator.frequency.value = 1000;
                gainNode.gain.value = 0.2;
                oscillator.type = 'sine';
                oscillator.start();
                oscillator.stop(state.audioContext.currentTime + 0.1);
                break;
            case 'launch':
                oscillator.frequency.value = 1200;
                gainNode.gain.value = 0.5;
                oscillator.type = 'square';
                oscillator.start();
                // Barrido ascendente
                oscillator.frequency.linearRampToValueAtTime(2000, state.audioContext.currentTime + 0.3);
                oscillator.stop(state.audioContext.currentTime + 0.5);
                break;
        }
    } catch (e) {
        console.warn('Error reproduciendo sonido:', e);
    }
}

// ==================== Pantalla Completa ====================
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.warn('Error al entrar en pantalla completa:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

// ==================== Exportar CSV ====================
function exportCSV() {
    if (state.launched.length === 0) {
        alert('No hay registros de salida para exportar.');
        return;
    }
    
    const headers = ['Orden', 'Dorsal', 'Nombre', 'Equipo', 'Hora Salida', 'Estado'];
    const rows = state.launched.map(record => [
        record.order,
        record.number,
        record.name,
        record.team || '',
        record.skipped ? '' : formatTimeCSV(record.launchTime),
        record.skipped ? 'SALTADO' : 'LANZADO'
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `contrarreloj_${formatDateFilename(new Date())}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
}

// ==================== Utilidades ====================
function padZero(num) {
    return String(num).padStart(2, '0');
}

function formatTime(date) {
    return `${padZero(date.getHours())}:${padZero(date.getMinutes())}:${padZero(date.getSeconds())}`;
}

function formatTimeCSV(date) {
    return `${padZero(date.getHours())}:${padZero(date.getMinutes())}:${padZero(date.getSeconds())}`;
}

function formatDateFilename(date) {
    return `${date.getFullYear()}${padZero(date.getMonth() + 1)}${padZero(date.getDate())}_${padZero(date.getHours())}${padZero(date.getMinutes())}`;
}

function updatePresetHighlight() {
    const totalSeconds = (parseInt(elements.intervalMin.value) || 0) * 60 + (parseInt(elements.intervalSec.value) || 0);
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.interval) === totalSeconds);
    });
}

// ==================== Iniciar Aplicacion ====================
document.addEventListener('DOMContentLoaded', init);
