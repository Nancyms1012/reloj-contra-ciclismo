/* ============================================
   CRONO CONTRARRELOJ - App Logic
   Reloj digital para lanzamientos CRI/CRE
   Con importacion formato UCI
   ============================================ */

// ==================== Estado de la aplicacion ====================
const state = {
    mode: 'setup',
    raceType: 'individual',
    interval: 60,
    startTime: null,
    alarmSeconds: 10,
    soundEnabled: true,
    riders: [], // [{number, lastName, name, team, startTime}]
    launched: [],
    currentIndex: 0,
    isRunning: false,
    isPaused: false,
    alertTimeout: null,
    audioContext: null,
    useCustomStartTimes: false, // true cuando se importan horas individuales
};


// ==================== Elementos del DOM ====================
const elements = {
    clockHours: document.getElementById('clock-hours'),
    clockMinutes: document.getElementById('clock-minutes'),
    clockSeconds: document.getElementById('clock-seconds'),
    clockMs: document.getElementById('clock-ms'),
    clockDate: document.getElementById('clock-date'),
    countdownSection: document.getElementById('countdown-section'),
    countdownMin: document.getElementById('countdown-min'),
    countdownSec: document.getElementById('countdown-sec'),
    countdownRider: document.getElementById('countdown-rider'),
    launchAlert: document.getElementById('launch-alert'),
    alertRiderName: document.getElementById('alert-rider-name'),
    alertRiderNumber: document.getElementById('alert-rider-number'),
    modeButtons: document.querySelectorAll('.mode-btn'),
    panelSetup: document.getElementById('panel-setup'),
    panelRunning: document.getElementById('panel-running'),
    panelResults: document.getElementById('panel-results'),
    intervalMin: document.getElementById('interval-min'),
    intervalSec: document.getElementById('interval-sec'),
    startHour: document.getElementById('start-hour'),
    startMin: document.getElementById('start-min'),
    startSec: document.getElementById('start-sec'),
    riderNumber: document.getElementById('rider-number'),
    riderLastname: document.getElementById('rider-lastname'),
    riderName: document.getElementById('rider-name'),
    riderTeam: document.getElementById('rider-team'),
    riderStartTime: document.getElementById('rider-start-time'),
    ridersList: document.getElementById('riders-list'),
    riderCount: document.getElementById('rider-count'),
    alarmSecondsInput: document.getElementById('alarm-seconds'),
    alarmSoundCheckbox: document.getElementById('alarm-sound'),
    ridersTitle: document.getElementById('riders-title'),
    currentRider: document.getElementById('current-rider'),
    nextRider: document.getElementById('next-rider'),
    launchedCount: document.getElementById('launched-count'),
    pendingCount: document.getElementById('pending-count'),
    upcomingList: document.getElementById('upcoming-list'),
    resultsList: document.getElementById('results-list'),
    btnFullscreen: document.getElementById('btn-fullscreen'),
    btnAddRider: document.getElementById('btn-add-rider'),
    btnClearRiders: document.getElementById('btn-clear-riders'),
    btnSortTime: document.getElementById('btn-sort-time'),
    btnSortBib: document.getElementById('btn-sort-bib'),
    btnStartRace: document.getElementById('btn-start-race'),
    btnManualLaunch: document.getElementById('btn-manual-launch'),
    btnSkipRider: document.getElementById('btn-skip-rider'),
    btnPauseRace: document.getElementById('btn-pause-race'),
    btnStopRace: document.getElementById('btn-stop-race'),
    btnExport: document.getElementById('btn-export'),
    fileImport: document.getElementById('file-import'),
    btnPasteImport: document.getElementById('btn-paste-import'),
    btnDownloadTemplate: document.getElementById('btn-download-template'),
    pasteModal: document.getElementById('paste-modal'),
    pasteTextarea: document.getElementById('paste-textarea'),
    btnPasteCancel: document.getElementById('btn-paste-cancel'),
    btnPasteConfirm: document.getElementById('btn-paste-confirm'),
    importValidation: document.getElementById('import-validation'),
};


// ==================== Inicializacion ====================
function init() {
    const now = new Date();
    elements.startHour.value = now.getHours();
    elements.startMin.value = now.getMinutes() + 5;
    if (parseInt(elements.startMin.value) >= 60) {
        elements.startMin.value = 0;
        elements.startHour.value = parseInt(elements.startHour.value) + 1;
    }
    setupEventListeners();
    updateClock();
    setInterval(updateClock, 200);
    setInterval(updateCountdown, 100);
}

function setupEventListeners() {
    elements.btnFullscreen.addEventListener('click', toggleFullscreen);
    elements.modeButtons.forEach(btn => {
        btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });
    document.querySelectorAll('input[name="tt-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.raceType = e.target.value;
            elements.ridersTitle.textContent = state.raceType === 'team' ? 'Equipos' : 'Corredores';
        });
    });
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const seconds = parseInt(btn.dataset.interval);
            elements.intervalMin.value = Math.floor(seconds / 60);
            elements.intervalSec.value = seconds % 60;
        });
    });
    elements.intervalMin.addEventListener('change', updatePresetHighlight);
    elements.intervalSec.addEventListener('change', updatePresetHighlight);
    elements.btnAddRider.addEventListener('click', addRider);
    elements.riderName.addEventListener('keypress', (e) => { if (e.key === 'Enter') addRider(); });
    elements.riderTeam.addEventListener('keypress', (e) => { if (e.key === 'Enter') addRider(); });
    elements.riderStartTime.addEventListener('keypress', (e) => { if (e.key === 'Enter') addRider(); });
    elements.btnClearRiders.addEventListener('click', () => {
        if (confirm('¿Limpiar toda la lista de corredores?')) {
            state.riders = [];
            state.useCustomStartTimes = false;
            renderRidersList();
        }
    });
    elements.btnSortTime.addEventListener('click', sortByTime);
    elements.btnSortBib.addEventListener('click', sortByBib);
    elements.btnStartRace.addEventListener('click', startRace);
    elements.btnManualLaunch.addEventListener('click', manualLaunch);
    elements.btnSkipRider.addEventListener('click', skipRider);
    elements.btnPauseRace.addEventListener('click', togglePause);
    elements.btnStopRace.addEventListener('click', stopRace);
    elements.btnExport.addEventListener('click', exportCSV);
    // Import UCI
    elements.fileImport.addEventListener('change', handleFileImport);
    elements.btnPasteImport.addEventListener('click', openPasteModal);
    elements.btnDownloadTemplate.addEventListener('click', downloadTemplate);
    elements.btnPasteCancel.addEventListener('click', closePasteModal);
    elements.btnPasteConfirm.addEventListener('click', confirmPasteImport);
}


// ==================== IMPORTACION UCI ====================

// Validaciones segun regulaciones UCI:
// - Dorsales: numeros enteros positivos (1-999)
// - Equipos: codigo de 3 letras mayusculas (ej: SOQ, IGD, VIS, UAE)
// - Intervalos minimos: 60s CRI, 120s-180s CRE (segun UCI)
// - Hora de salida: formato HH:MM:SS
// - Apellido en mayusculas (convencion UCI)

const UCI_RULES = {
    MIN_INTERVAL_CRI: 60,    // 1 minuto minimo entre salidas individuales
    MIN_INTERVAL_CRE: 120,   // 2 minutos minimo entre equipos
    MAX_INTERVAL: 300,        // 5 minutos maximo
    TEAM_CODE_LENGTH: 3,      // Codigo equipo 3 caracteres
    MIN_BIB: 1,
    MAX_BIB: 999,
};

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        parseAndImportUCI(content);
    };
    reader.readAsText(file, 'UTF-8');
    // Reset input para permitir reimportar mismo archivo
    event.target.value = '';
}

function openPasteModal() {
    elements.pasteModal.classList.remove('hidden');
    elements.pasteTextarea.focus();
}

function closePasteModal() {
    elements.pasteModal.classList.add('hidden');
    elements.pasteTextarea.value = '';
}

function confirmPasteImport() {
    const data = elements.pasteTextarea.value.trim();
    if (!data) {
        alert('No hay datos para importar.');
        return;
    }
    parseAndImportUCI(data);
    closePasteModal();
}

function downloadTemplate() {
    const template = `Dorsal;Apellido;Nombre;Equipo;Hora_Salida
1;EVENEPOEL;Remco;SOQ;09:01:00
2;GANNA;Filippo;IGD;09:02:00
3;TARLING;Joshua;IGD;09:03:00
4;KUNG;Stefan;GFC;09:04:00
5;VAN AERT;Wout;VIS;09:05:00
6;POGACAR;Tadej;UAE;09:06:00
7;VINGEGAARD;Jonas;VIS;09:07:00
8;MCNULTY;Brandon;UAE;09:08:00`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_lista_salida_UCI.csv';
    link.click();
    URL.revokeObjectURL(url);
}


function parseAndImportUCI(rawData) {
    const lines = rawData.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
        showValidation('error', 'No se encontraron datos para importar.');
        return;
    }

    // Detectar separador (;  ,  o tab)
    let separator = ';';
    const firstDataLine = lines.find(l => !isHeaderLine(l)) || lines[0];
    if (firstDataLine.includes(';')) separator = ';';
    else if (firstDataLine.includes('\t')) separator = '\t';
    else if (firstDataLine.includes(',')) separator = ',';

    const imported = [];
    const errors = [];
    let hasStartTimes = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Saltar lineas de encabezado
        if (isHeaderLine(line)) continue;

        const fields = line.split(separator).map(f => f.trim());
        if (fields.length < 3) {
            errors.push(`Linea ${i + 1}: Datos insuficientes (minimo: Dorsal, Apellido, Nombre)`);
            continue;
        }

        const bib = fields[0];
        const lastName = fields[1];
        const firstName = fields[2];
        const team = fields.length > 3 ? fields[3] : '';
        const startTimeStr = fields.length > 4 ? fields[4] : '';

        // Validar dorsal UCI
        const bibNum = parseInt(bib);
        if (isNaN(bibNum) || bibNum < UCI_RULES.MIN_BIB || bibNum > UCI_RULES.MAX_BIB) {
            errors.push(`Linea ${i + 1}: Dorsal "${bib}" invalido (debe ser 1-999)`);
            continue;
        }

        // Validar nombre
        if (!lastName || !firstName) {
            errors.push(`Linea ${i + 1}: Apellido y Nombre son obligatorios`);
            continue;
        }

        // Validar codigo equipo UCI (3 letras)
        if (team && team.length > 0 && team.length !== UCI_RULES.TEAM_CODE_LENGTH) {
            errors.push(`Linea ${i + 1}: Codigo equipo "${team}" debe ser de ${UCI_RULES.TEAM_CODE_LENGTH} caracteres (norma UCI)`);
            continue;
        }

        // Validar hora de salida
        let parsedStartTime = null;
        if (startTimeStr) {
            parsedStartTime = parseTimeString(startTimeStr);
            if (!parsedStartTime) {
                errors.push(`Linea ${i + 1}: Hora "${startTimeStr}" invalida (formato HH:MM:SS)`);
                continue;
            }
            hasStartTimes = true;
        }

        // Verificar dorsal duplicado en importacion
        if (imported.some(r => r.number === String(bibNum))) {
            errors.push(`Linea ${i + 1}: Dorsal #${bibNum} duplicado`);
            continue;
        }

        imported.push({
            number: String(bibNum),
            lastName: lastName.toUpperCase(), // UCI usa apellidos en mayusculas
            name: firstName,
            displayName: `${lastName.toUpperCase()} ${firstName}`,
            team: team.toUpperCase(),
            startTime: parsedStartTime,
        });
    }

    // Mostrar resultados de validacion
    if (imported.length === 0) {
        showValidation('error', `No se pudo importar ningun corredor. ${errors.length} errores encontrados.`);
        if (errors.length > 0) {
            showValidation('error', errors.slice(0, 5).join('<br>'));
        }
        return;
    }

    // Validar intervalos UCI si hay horas de salida
    if (hasStartTimes && imported.length > 1) {
        const intervalWarnings = validateUCIIntervals(imported);
        if (intervalWarnings.length > 0) {
            errors.push(...intervalWarnings);
        }
    }

    // Importar corredores
    state.riders = imported;
    state.useCustomStartTimes = hasStartTimes;

    // Si hay horas de salida, configurar la hora de inicio automaticamente
    if (hasStartTimes && imported[0].startTime) {
        elements.startHour.value = imported[0].startTime.hours;
        elements.startMin.value = imported[0].startTime.minutes;
        elements.startSec.value = imported[0].startTime.seconds;
    }

    renderRidersList();

    // Mensaje de exito
    let msg = `Importados ${imported.length} ${state.raceType === 'team' ? 'equipos' : 'corredores'} correctamente.`;
    if (errors.length > 0) {
        msg += ` (${errors.length} advertencia(s))`;
    }
    showValidation(errors.length > 0 ? 'warning' : 'success', msg);
}


function isHeaderLine(line) {
    const lower = line.toLowerCase();
    return lower.includes('dorsal') || lower.includes('bib') || lower.includes('apellido') ||
           lower.includes('lastname') || lower.includes('nombre') || lower.includes('name') ||
           lower.includes('hora') || lower.includes('start') || lower.includes('equipo');
}

function parseTimeString(str) {
    // Acepta HH:MM:SS o HH:MM
    const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;
    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const seconds = match[3] ? parseInt(match[3]) : 0;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
        return null;
    }
    return { hours, minutes, seconds, totalSeconds: hours * 3600 + minutes * 60 + seconds };
}

function validateUCIIntervals(riders) {
    const warnings = [];
    const minInterval = state.raceType === 'team' ? UCI_RULES.MIN_INTERVAL_CRE : UCI_RULES.MIN_INTERVAL_CRI;

    for (let i = 1; i < riders.length; i++) {
        if (riders[i].startTime && riders[i - 1].startTime) {
            const diff = riders[i].startTime.totalSeconds - riders[i - 1].startTime.totalSeconds;
            if (diff < minInterval) {
                warnings.push(
                    `Advertencia UCI: Intervalo entre #${riders[i-1].number} y #${riders[i].number} es ${diff}s (minimo UCI: ${minInterval}s)`
                );
            }
        }
    }
    return warnings;
}

function showValidation(type, message) {
    const el = elements.importValidation;
    el.classList.remove('hidden', 'validation-success', 'validation-error', 'validation-warning');
    el.classList.add(`validation-${type}`);
    el.innerHTML = message;
    // Auto-ocultar despues de 8 segundos
    setTimeout(() => el.classList.add('hidden'), 8000);
}

function sortByTime() {
    state.riders.sort((a, b) => {
        if (a.startTime && b.startTime) {
            return a.startTime.totalSeconds - b.startTime.totalSeconds;
        }
        return 0;
    });
    renderRidersList();
}

function sortByBib() {
    state.riders.sort((a, b) => parseInt(a.number) - parseInt(b.number));
    renderRidersList();
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
        triggerLaunch();
        return;
    }
    elements.countdownSection.classList.remove('hidden');
    const totalSeconds = Math.ceil(diff / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    elements.countdownMin.textContent = padZero(minutes);
    elements.countdownSec.textContent = padZero(seconds);
    const nextRiderData = state.riders[state.currentIndex];
    if (nextRiderData) {
        const label = state.raceType === 'team' ? 'Equipo' : 'Dorsal';
        const displayName = nextRiderData.displayName || nextRiderData.name;
        elements.countdownRider.textContent = `${label} #${nextRiderData.number} - ${displayName}`;
    }
    if (totalSeconds <= state.alarmSeconds) {
        elements.countdownSection.classList.add('warning');
        if (totalSeconds <= state.alarmSeconds && totalSeconds > state.alarmSeconds - 1) {
            playBeep('warning');
        }
        if (totalSeconds <= 5 && seconds !== 0) {
            playBeep('tick');
        }
    } else {
        elements.countdownSection.classList.remove('warning');
    }
}

function getNextLaunchTime() {
    if (state.currentIndex >= state.riders.length) return null;
    const rider = state.riders[state.currentIndex];
    // Si tiene hora personalizada (importada UCI)
    if (state.useCustomStartTimes && rider.startTime) {
        const today = new Date();
        const launchTime = new Date(today);
        launchTime.setHours(rider.startTime.hours, rider.startTime.minutes, rider.startTime.seconds, 0);
        return launchTime;
    }
    // Modo intervalo fijo
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
    state.launched.push({
        ...rider,
        launchTime: now,
        scheduledTime: getNextLaunchTime(),
        skipped: false,
        order: state.launched.length + 1
    });
    showLaunchAlert(rider);
    playBeep('launch');
    state.currentIndex++;
    updateRunningPanel();
    updateResultsPanel();
    if (state.currentIndex >= state.riders.length) {
        setTimeout(() => finishRace(), 3000);
    }
}

function showLaunchAlert(rider) {
    const displayName = rider.displayName || rider.name;
    elements.alertRiderName.textContent = displayName;
    elements.alertRiderNumber.textContent = `#${rider.number}`;
    elements.launchAlert.classList.remove('hidden');
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
    if (state.riders.length === 0) {
        alert('Agrega al menos un corredor/equipo antes de iniciar.');
        return;
    }
    state.interval = (parseInt(elements.intervalMin.value) || 0) * 60 + (parseInt(elements.intervalSec.value) || 0);
    if (!state.useCustomStartTimes && state.interval < 10) {
        alert('El intervalo minimo es de 10 segundos.');
        return;
    }
    // Validar intervalos UCI
    if (!state.useCustomStartTimes) {
        const minUCI = state.raceType === 'team' ? UCI_RULES.MIN_INTERVAL_CRE : UCI_RULES.MIN_INTERVAL_CRI;
        if (state.interval < minUCI) {
            if (!confirm(`Advertencia UCI: El intervalo de ${state.interval}s es menor al minimo recomendado (${minUCI}s para ${state.raceType === 'team' ? 'CRE' : 'CRI'}). ¿Continuar de todos modos?`)) {
                return;
            }
        }
    }
    const now = new Date();
    state.startTime = new Date(now);
    state.startTime.setHours(parseInt(elements.startHour.value) || 0);
    state.startTime.setMinutes(parseInt(elements.startMin.value) || 0);
    state.startTime.setSeconds(parseInt(elements.startSec.value) || 0);
    state.startTime.setMilliseconds(0);
    if (!state.useCustomStartTimes && state.startTime.getTime() < now.getTime()) {
        const confirm_past = confirm('La hora de inicio ya paso. ¿Deseas iniciar en 30 segundos desde ahora?');
        if (confirm_past) {
            state.startTime = new Date(now.getTime() + 30000);
            state.startTime.setMilliseconds(0);
        } else {
            return;
        }
    }
    state.alarmSeconds = parseInt(elements.alarmSecondsInput.value) || 10;
    state.soundEnabled = elements.alarmSoundCheckbox.checked;
    state.isRunning = true;
    state.isPaused = false;
    state.currentIndex = 0;
    state.launched = [];
    initAudio();
    switchMode('running');
    updateRunningPanel();
}

function togglePause() {
    state.isPaused = !state.isPaused;
    elements.btnPauseRace.textContent = state.isPaused ? 'REANUDAR' : 'PAUSAR';
    elements.btnPauseRace.classList.toggle('btn-warning');
    elements.btnPauseRace.classList.toggle('btn-start');
    if (state.isPaused) elements.countdownSection.classList.add('hidden');
}

function stopRace() {
    if (!confirm('¿Detener la contrarreloj? Se conservaran los registros.')) return;
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
    const lastName = elements.riderLastname.value.trim();
    const name = elements.riderName.value.trim();
    const team = elements.riderTeam.value.trim();
    const startTimeStr = elements.riderStartTime.value.trim();

    if (!number || !lastName) {
        alert('Ingresa al menos el dorsal y el apellido.');
        return;
    }
    const bibNum = parseInt(number);
    if (isNaN(bibNum) || bibNum < UCI_RULES.MIN_BIB || bibNum > UCI_RULES.MAX_BIB) {
        alert(`Dorsal invalido. Debe ser un numero entre ${UCI_RULES.MIN_BIB} y ${UCI_RULES.MAX_BIB} (norma UCI).`);
        return;
    }
    if (team && team.length !== UCI_RULES.TEAM_CODE_LENGTH && team.length > 0) {
        alert(`El codigo de equipo debe ser de ${UCI_RULES.TEAM_CODE_LENGTH} caracteres segun norma UCI (ej: SOQ, IGD, VIS).`);
        return;
    }
    if (state.riders.some(r => r.number === String(bibNum))) {
        alert('Ya existe un corredor con ese dorsal.');
        return;
    }
    let parsedTime = null;
    if (startTimeStr) {
        parsedTime = parseTimeString(startTimeStr);
        if (!parsedTime) {
            alert('Hora de salida invalida. Use formato HH:MM:SS');
            return;
        }
        state.useCustomStartTimes = true;
    }
    state.riders.push({
        number: String(bibNum),
        lastName: lastName.toUpperCase(),
        name: name,
        displayName: `${lastName.toUpperCase()} ${name}`,
        team: team.toUpperCase(),
        startTime: parsedTime,
    });
    elements.riderNumber.value = '';
    elements.riderLastname.value = '';
    elements.riderName.value = '';
    elements.riderTeam.value = '';
    elements.riderStartTime.value = '';
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
        let timeDisplay;
        if (rider.startTime) {
            timeDisplay = `${padZero(rider.startTime.hours)}:${padZero(rider.startTime.minutes)}:${padZero(rider.startTime.seconds)}`;
        } else {
            timeDisplay = calculateLaunchTime(index, interval);
        }
        const displayName = rider.displayName || rider.name;
        return `
            <div class="rider-item">
                <span class="rider-num">#${rider.number}</span>
                <div class="rider-info">
                    <div class="name">${displayName}</div>
                    ${rider.team ? `<div class="team">${rider.team}</div>` : ''}
                </div>
                <span class="rider-time">${timeDisplay}</span>
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
    const getDisplay = (r) => r ? `#${r.number} ${r.displayName || r.name}` : '-';
    elements.currentRider.textContent = currentRider ? getDisplay(currentRider) : 'Finalizado';
    elements.nextRider.textContent = getDisplay(nextRider);
    elements.launchedCount.textContent = state.launched.length;
    elements.pendingCount.textContent = state.riders.length - state.currentIndex;
    const upcoming = [];
    for (let i = state.currentIndex; i < Math.min(state.currentIndex + 5, state.riders.length); i++) {
        const rider = state.riders[i];
        let launchTime;
        if (state.useCustomStartTimes && rider.startTime) {
            const today = new Date();
            launchTime = new Date(today);
            launchTime.setHours(rider.startTime.hours, rider.startTime.minutes, rider.startTime.seconds, 0);
        } else {
            launchTime = new Date(state.startTime.getTime() + (i * state.interval * 1000));
        }
        upcoming.push({ rider, time: launchTime });
    }
    elements.upcomingList.innerHTML = upcoming.map(item => `
        <div class="upcoming-item">
            <span class="up-time">${formatTime(item.time)}</span>
            <span class="up-number">#${item.rider.number}</span>
            <span class="up-name">${item.rider.displayName || item.rider.name}</span>
            ${item.rider.team ? `<span class="up-team">${item.rider.team}</span>` : ''}
        </div>
    `).join('');
}

function updateResultsPanel() {
    elements.resultsList.innerHTML = state.launched.map(record => {
        const displayName = record.displayName || record.name;
        return `
            <div class="result-item ${record.skipped ? 'skipped' : ''}">
                <span class="res-order">${record.order}</span>
                <span class="res-number">#${record.number}</span>
                <span class="res-name">${displayName}${record.team ? ` (${record.team})` : ''}</span>
                <span class="res-time">${record.skipped ? 'SALTADO' : formatTime(record.launchTime)}</span>
            </div>
        `;
    }).join('');
}

// ==================== Navegacion ====================
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
    } catch (e) { console.warn('Audio no disponible:', e); }
}

function playBeep(type) {
    if (!state.soundEnabled || !state.audioContext) return;
    try {
        const osc = state.audioContext.createOscillator();
        const gain = state.audioContext.createGain();
        osc.connect(gain);
        gain.connect(state.audioContext.destination);
        switch (type) {
            case 'warning':
                osc.frequency.value = 800; gain.gain.value = 0.3; osc.type = 'sine';
                osc.start(); osc.stop(state.audioContext.currentTime + 0.2); break;
            case 'tick':
                osc.frequency.value = 1000; gain.gain.value = 0.2; osc.type = 'sine';
                osc.start(); osc.stop(state.audioContext.currentTime + 0.1); break;
            case 'launch':
                osc.frequency.value = 1200; gain.gain.value = 0.5; osc.type = 'square';
                osc.start();
                osc.frequency.linearRampToValueAtTime(2000, state.audioContext.currentTime + 0.3);
                osc.stop(state.audioContext.currentTime + 0.5); break;
        }
    } catch (e) { console.warn('Error sonido:', e); }
}

// ==================== Pantalla Completa ====================
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.warn(err));
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
    const headers = ['Orden', 'Dorsal', 'Apellido', 'Nombre', 'Equipo', 'Hora Salida', 'Estado'];
    const rows = state.launched.map(record => [
        record.order, record.number, record.lastName || '', record.name,
        record.team || '',
        record.skipped ? '' : formatTimeCSV(record.launchTime),
        record.skipped ? 'SALTADO' : 'LANZADO'
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contrarreloj_${formatDateFilename(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// ==================== Utilidades ====================
function padZero(num) { return String(num).padStart(2, '0'); }
function formatTime(date) { return `${padZero(date.getHours())}:${padZero(date.getMinutes())}:${padZero(date.getSeconds())}`; }
function formatTimeCSV(date) { return formatTime(date); }
function formatDateFilename(date) {
    return `${date.getFullYear()}${padZero(date.getMonth()+1)}${padZero(date.getDate())}_${padZero(date.getHours())}${padZero(date.getMinutes())}`;
}
function updatePresetHighlight() {
    const totalSeconds = (parseInt(elements.intervalMin.value) || 0) * 60 + (parseInt(elements.intervalSec.value) || 0);
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.interval) === totalSeconds);
    });
}

// ==================== Iniciar ====================
document.addEventListener('DOMContentLoaded', init);
