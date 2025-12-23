import { CONFIG } from './config.js';

// ฟังก์ชันสลับหน้าจอ (Dashboard <-> Monitor)
export function toggleView(viewName) {
    document.getElementById('view-dashboard').classList.add('d-none');
    document.getElementById('view-monitor').classList.add('d-none');
    
    if (viewName === 'dashboard') {
        document.getElementById('view-dashboard').classList.remove('d-none');
    } else {
        document.getElementById('view-monitor').classList.remove('d-none');
    }
}

// อัปเดตนาฬิกา
export function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('th-TH', { hour12: false });
    const el = document.getElementById('dash-clock');
    if(el) el.innerText = timeString;
}

// --- DASHBOARD RENDER ---
export function renderDashboardGrid(machines) {
    const gridForming = document.getElementById('grid-forming');
    const gridPacking = document.getElementById('grid-packing');
    const gridQC = document.getElementById('grid-qc'); 

    if(gridForming) gridForming.innerHTML = '';
    if(gridPacking) gridPacking.innerHTML = '';
    if(gridQC) gridQC.innerHTML = '';

    machines.forEach(mc => {
        // ------------------------------------------------------------------
        // LOGIC CHECK ALARM (DASHBOARD)
        // ------------------------------------------------------------------
        
        // เช็คก่อนเลยว่าเครื่องทำงานอยู่ไหม? (ถ้า Lot End หรือ Stop จะเป็น false)
        const isRunning = mc.mode === 'run';

        // 1. Volt: เช็ค Range + ต้อง Run อยู่เท่านั้น
        const isAlarmV = isRunning && (Math.abs(mc.currentV - mc.stdV) > CONFIG.ALARM_TOLERANCE);

        // 2. Amp: เช็ค Overload + ต้อง Run อยู่เท่านั้น
        const isAlarmA = isRunning && (mc.currentA > (mc.stdA + CONFIG.ALARM_TOLERANCE));
        
        // ------------------------------------------------------------------

        const statusClass = mc.mode === 'run' ? 'status-run' : 'status-stop';
        const statusText = mc.mode === 'run' ? 'RUNNING' : 'STOPPED';
        
        // ถ้า Alarm ให้ตัวหนังสือเป็นสีแดง
        const textV = isAlarmV ? 'text-danger fw-bold' : 'text-success';
        const textA = isAlarmA ? 'text-danger fw-bold' : 'text-success';
        
        // ถ้ามี Alarm อย่างใดอย่างหนึ่ง ให้ขอบการ์ดแดงกระพริบ
        const cardBorder = (isAlarmV || isAlarmA) ? 'card-alarm' : '';
        const alarmBadgeDisplay = (isAlarmV || isAlarmA) ? 'block' : 'none';

        const html = `
        <div class="col-xl-3 col-lg-4 col-md-6">
            <div class="card h-100 shadow-sm ${cardBorder}" data-id="${mc.id}">
                <div class="card-header d-flex justify-content-between align-items-center bg-white py-2">
                    <h6 class="m-0 fw-bold text-secondary"><i class="bi bi-cpu me-2"></i>${mc.name}</h6>
                    <span class="badge ${statusClass}">${statusText}</span>
                </div>
                <div class="card-body position-relative p-3">
                    <button class="position-absolute top-0 end-0 m-2 badge rounded-pill bg-danger border-0 alarm-badge-btn" 
                            style="display: ${alarmBadgeDisplay}; z-index: 10;">
                        ALARM
                    </button>
                    
                    <div class="card-click-area" style="cursor: pointer;">
                        <div class="mb-2">
                            <small class="text-muted d-block" style="font-size: 0.75rem;">Lot No.</small>
                            <span class="fw-bold fs-5 text-dark">${mc.lot}</span>
                        </div>
                        <div class="row g-2">
                            <div class="col-6">
                                <div class="p-2 bg-light rounded text-center">
                                    <small class="d-block text-secondary" style="font-size: 0.7rem;">VOLT (Avg)</small>
                                    <span class="${textV} fs-5">${mc.currentV.toFixed(2)} V</span>
                                    <div style="font-size: 0.65rem;" class="text-muted">Std: ${mc.stdV}</div>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="p-2 bg-light rounded text-center">
                                    <small class="d-block text-secondary" style="font-size: 0.7rem;">AMP (Avg)</small>
                                    <span class="${textA} fs-5">${mc.currentA.toFixed(2)} A</span>
                                    <div style="font-size: 0.65rem;" class="text-muted">Std: ${mc.stdA}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-footer bg-white py-1">
                    <small class="text-muted" style="font-size: 0.7rem;">
                        <i class="bi bi-clock-history me-1"></i>Last update: ${new Date(mc.lastUpdate).toLocaleTimeString()}
                    </small>
                </div>
            </div>
        </div>
        `;

        if (mc.department === 'forming' && gridForming) {
            gridForming.insertAdjacentHTML('beforeend', html);
        } else if (mc.department === 'packing' && gridPacking) {
            gridPacking.insertAdjacentHTML('beforeend', html);
        } else if (mc.department === 'qc' && gridQC) {
            gridQC.insertAdjacentHTML('beforeend', html);
        }
    });
}

// --- MONITOR TABLE RENDER ---

export function fillHistoryTable(data, mc) {
    const tbody = document.getElementById('historyBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    data.forEach(row => {
        prependHistoryRow(row.timeStr, row.volts, row.amps, mc, null); 
    });
}

export function prependHistoryRow(timeStr, volts, amps, mc, onAlarm) {
    const tbody = document.getElementById('historyBody');
    if(!tbody) return;

    const tr = document.createElement('tr');
    
    // เช็คสถานะเครื่อง (ต้อง Run เท่านั้นถึงจะ Alarm)
    const isRunning = mc.mode === 'run';

    // 1. Column Volt
    const voltCols = volts.map((val, idx) => {
        // Logic: ต้อง Run อยู่ และ ค่าผิดปกติ
        const isAlarm = isRunning && (Math.abs(val - mc.stdV) > CONFIG.ALARM_TOLERANCE);
        
        if (isAlarm) {
            if (onAlarm) onAlarm(timeStr, 'Volt', idx + 1, val, mc.stdV);
            return `<td class="text-danger fw-bold" style="background-color: rgba(220,53,69,0.05);">${val.toFixed(2)}</td>`;
        }
        return `<td>${val.toFixed(2)}</td>`;
    }).join('');

    // 2. Column Amp
    const ampCols = amps.map((val, idx) => {
        // Logic: ต้อง Run อยู่ และ ค่าเกิน (Overload)
        const isAlarm = isRunning && (val > (mc.stdA + CONFIG.ALARM_TOLERANCE));
        
        if (isAlarm) {
            if (onAlarm) onAlarm(timeStr, 'Amp', idx + 1, val, mc.stdA);
            return `<td class="text-danger fw-bold" style="background-color: rgba(220,53,69,0.05);">${val.toFixed(2)}</td>`;
        }
        return `<td>${val.toFixed(2)}</td>`;
    }).join('');

    tr.innerHTML = `
        <td class="text-secondary">${timeStr}</td>
        ${voltCols}
        ${ampCols}
    `;

    tbody.prepend(tr);

    if (tbody.children.length > CONFIG.HISTORY_ROWS) {
        tbody.lastElementChild.remove();
    }
}

// --- HELPER: ALARM LOGS ---

export function addAlarmLog(time, type, ch, val, std) {
    const tbody = document.getElementById('alarmBody');
    if(!tbody) return;

    const badge = document.getElementById('alarmBadge');
    if(badge) {
        let count = parseInt(badge.innerText) || 0;
        badge.innerText = count + 1;
        badge.style.display = 'inline-block';
    }

    const row = `
        <tr>
            <td>${time}</td>
            <td><span class="badge bg-danger">${type}</span></td>
            <td>CH-${ch}</td>
            <td class="fw-bold text-danger">${val.toFixed(2)}</td>
            <td class="text-muted">${std.toFixed(2)}</td>
        </tr>
    `;
    tbody.insertAdjacentHTML('afterbegin', row);
}

export function addRecentAlarm(time, type, ch, val, std) {
    const tbody = document.getElementById('recent-alarms-body');
    if(!tbody) return;

    const row = `
        <tr>
            <td><small>${time}</small></td>
            <td><span class="badge bg-danger" style="font-size: 0.7rem;">${type}</span></td>
            <td><small>CH-${ch}</small></td>
            <td class="fw-bold text-danger"><small>${val.toFixed(2)}</small></td>
            <td><small class="text-muted">Std: ${std}</small></td>
        </tr>
    `;
    tbody.insertAdjacentHTML('afterbegin', row);

    if (tbody.children.length > 5) {
        tbody.lastElementChild.remove();
    }
}

export function showAlarmModalDirectly() {
    const modalEl = document.getElementById('alarmModal');
    if(modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}