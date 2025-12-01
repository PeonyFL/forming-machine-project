import { CONFIG } from './config.js';
import { formatDateTime } from './utils.js';

export function toggleView(viewName) {
    const dash = document.getElementById('view-dashboard');
    const monitor = document.getElementById('view-monitor');
    if (viewName === 'monitor') {
        dash.classList.add('d-none');
        monitor.classList.remove('d-none');
        monitor.classList.add('d-flex');
    } else {
        monitor.classList.add('d-none');
        monitor.classList.remove('d-flex');
        dash.classList.remove('d-none');
    }
}

export function updateClock() {
    document.getElementById('dash-clock').innerText = formatDateTime(new Date());
}

export function renderDashboardGrid(machines) {
    const gridForming = document.getElementById('grid-forming');
    const gridTapping = document.getElementById('grid-tapping');
    
    // เคลียร์ค่าเก่า
    if(gridForming) gridForming.innerHTML = '';
    if(gridTapping) gridTapping.innerHTML = '';

    machines.forEach(mc => {
        const { status, cssClass, badgeClass, textV, textA } = getStatusStyles(mc, mc.currentV, mc.currentA);
        const badgePointer = status === 'ALARM' ? 'cursor-pointer' : '';
        const badgeTitle = status === 'ALARM' ? 'title="Click to see Alarm Log"' : '';

        const html = `
            <div class="col-md-6 col-lg-3">
                <div class="card shadow-sm h-100 ${cssClass}" data-id="${mc.id}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="fw-bold mb-0 text-secondary">${mc.name}</h6>
                            <span class="badge ${badgeClass} border px-3 py-2 ${badgePointer} alarm-badge-btn" ${badgeTitle} style="min-width: 80px;">
                                ${status}
                            </span>
                        </div>
                        <div class="mb-3 small">
                            <div class="d-flex justify-content-between text-muted"><span>Lot:</span> <span class="fw-bold text-dark">${mc.lot}</span></div>
                            <div class="d-flex justify-content-between text-muted"><span>Spec:</span> <span class="fw-bold text-dark">${mc.spec}</span></div>
                        </div>
                        <div class="row g-2 text-center">
                            <div class="col-6 cursor-pointer card-click-area"><div class="bg-light rounded p-2 border"><small class="text-secondary d-block" style="font-size:0.7rem">VOLT</small><span class="fw-bold ${textV}">${mc.currentV} V</span></div></div>
                            <div class="col-6 cursor-pointer card-click-area"><div class="bg-light rounded p-2 border"><small class="text-secondary d-block" style="font-size:0.7rem">AMP</small><span class="fw-bold ${textA}">${mc.currentA} A</span></div></div>
                        </div>
                    </div>
                    <div class="card-footer bg-white border-0 text-center pb-3 cursor-pointer card-click-area"><small class="text-muted">Click for Details <i class="bi bi-arrow-right"></i></small></div>
                </div>
            </div>`;

        // แยกแผนก
        if (mc.department === 'forming' && gridForming) {
            gridForming.insertAdjacentHTML('beforeend', html);
        } else if (mc.department === 'tapping' && gridTapping) {
            gridTapping.insertAdjacentHTML('beforeend', html);
        }
    });
}

function createRowHTML(timeStr, volts, amps, stdV, stdA) {
    let html = `<td class="fw-bold text-secondary" style="font-size:0.65rem; white-space:nowrap;">${timeStr}</td>`;
    volts.forEach(v => {
        if (Math.abs(v - stdV) > CONFIG.ALARM_TOLERANCE) html += `<td class="text-alarm">${v}</td>`;
        else html += `<td class="text-success">${v}</td>`;
    });
    amps.forEach(a => {
        if (Math.abs(a - stdA) > CONFIG.ALARM_TOLERANCE) html += `<td class="text-alarm">${a}</td>`;
        else html += `<td class="text-primary">${a}</td>`;
    });
    return html;
}

export function fillHistoryTable(historyArray, machine) {
    const tbody = document.getElementById('historyBody');
    tbody.innerHTML = ''; 
    const fragment = document.createDocumentFragment();
    for (let i = historyArray.length - 1; i >= 0; i--) {
        const item = historyArray[i];
        const tr = document.createElement('tr');
        tr.innerHTML = createRowHTML(item.timeStr, item.volts, item.amps, machine.stdV, machine.stdA);
        fragment.appendChild(tr);
    }
    tbody.appendChild(fragment);
}

export function prependHistoryRow(timeStr, volts, amps, machine, onAlarm) {
    const tbody = document.getElementById('historyBody');
    const tr = document.createElement('tr');
    tr.innerHTML = createRowHTML(timeStr, volts, amps, machine.stdV, machine.stdA);
    tbody.prepend(tr);
    if(tbody.children.length > CONFIG.HISTORY_ROWS) tbody.lastElementChild.remove();

    if(onAlarm) {
        volts.forEach((v, idx) => { if(Math.abs(v - machine.stdV) > CONFIG.ALARM_TOLERANCE) onAlarm(timeStr, 'Volt', idx+1, v, machine.stdV); });
        amps.forEach((a, idx) => { if(Math.abs(a - machine.stdA) > CONFIG.ALARM_TOLERANCE) onAlarm(timeStr, 'Amp', idx+1, a, machine.stdA); });
    }
}

export function addRecentAlarm(time, type, ch, val, std) {
    const tbody = document.getElementById('recent-alarms-body');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="text-secondary" style="font-size:0.7rem">${time}</td><td class="fw-bold ${type === 'Volt' ? 'text-success' : 'text-primary'}">${type}</td><td>#${ch}</td><td class="text-danger fw-bold">${val}</td><td class="text-muted">${std}</td>`;
    tbody.prepend(tr);
    if (tbody.children.length > 5) tbody.lastElementChild.remove();
}

export function addAlarmLog(time, type, ch, val, std) {
    const tbody = document.getElementById('alarmBody');
    const badge = document.getElementById('alarmBadge');
    const currentCount = parseInt(badge.innerText || '0') + 1;
    badge.innerText = currentCount;
    if(badge.style.display === 'none') badge.style.display = 'inline-block';
    const tr = document.createElement('tr');
    tr.className = "bg-danger bg-opacity-10";
    tr.innerHTML = `<td style="font-size:0.7rem">${time}</td><td class="fw-bold">${type}</td><td>#${ch}</td><td class="text-danger fw-bold">${val}</td><td>${std}</td>`;
    tbody.prepend(tr);
}

export function showAlarmModalDirectly() {
    const modalElement = document.getElementById('alarmModal');
    // @ts-ignore
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

function getStatusStyles(mc, v, a) {
    if (mc.mode === 'stop') return { status: 'STOPPED', cssClass: 'card-stop', badgeClass: 'bg-secondary', textV: 'text-muted', textA: 'text-muted' };
    const isAlarmV = Math.abs(v - mc.stdV) > CONFIG.ALARM_TOLERANCE;
    const isAlarmA = Math.abs(a - mc.stdA) > CONFIG.ALARM_TOLERANCE;
    if (isAlarmV || isAlarmA) return { status: 'ALARM', cssClass: 'card-alarm', badgeClass: 'bg-danger blink-text', textV: isAlarmV ? 'text-danger fw-bold blink-text' : 'text-success', textA: isAlarmA ? 'text-danger fw-bold blink-text' : 'text-primary' };
    return { status: 'RUNNING', cssClass: 'card-running', badgeClass: 'bg-success', textV: 'text-success', textA: 'text-primary' };
}