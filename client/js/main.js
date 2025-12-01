import { CONFIG } from './config.js';
import * as API from './api.js';
import * as UI from './ui.js';
import * as Charts from './charts.js';
import { calculateAverage, generateHistoryData, formatDateTime } from './utils.js';

let dashboardInterval = null;
let monitorInterval = null;
let currentMachineId = null;
let lastLotName = ""; 
let allMachinesCache = []; 

function init() {
    // ----------------------------------------------------
    // 1. ตรวจสอบ URL Parameter (ฟีเจอร์ใหม่)
    // ----------------------------------------------------
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('id');

    if (targetId) {
        // กรณี: มี ?id=X (Kiosk Mode / หน้าเครื่องจักร)
        console.log(`Direct access to Machine ID: ${targetId}`);
        
        // ข้าม Dashboard ไปเปิดหน้า Monitor เลย
        openMonitor(parseInt(targetId));

        // ซ่อนปุ่ม Back เพื่อไม่ให้กดกลับไปหน้า Dashboard ได้
        const btnBack = document.getElementById('btn-back');
        if (btnBack) btnBack.style.display = 'none';
        
    } else {
        // กรณี: ไม่มี ?id (Manager Mode / Dashboard รวม)
        UI.toggleView('dashboard');
        startDashboard();
    }

    // ----------------------------------------------------
    // 2. Event Listeners
    // ----------------------------------------------------
    document.getElementById('view-dashboard').addEventListener('click', (e) => {
        const card = e.target.closest('.card');
        if (!card) return;
        const id = parseInt(card.dataset.id);

        if (e.target.closest('.alarm-badge-btn') && e.target.closest('.bg-danger')) {
            openDashboardAlarm(id);
        } else if (e.target.closest('.card-click-area') || e.target.closest('.card-body')) {
            openMonitor(id);
        }
    });

    document.getElementById('btn-back').addEventListener('click', backToDashboard);
    
    // เริ่มระบบ Export
    initExportSystem();
}

// --- Dashboard Logic ---
function startDashboard() {
    runDashboardLoop();
    if (dashboardInterval) clearInterval(dashboardInterval);
    dashboardInterval = setInterval(runDashboardLoop, CONFIG.DASHBOARD_INTERVAL);
}

async function runDashboardLoop() {
    const machines = await API.fetchAllMachines();
    allMachinesCache = machines; // เก็บ Cache ไว้ใช้ตอน Export
    UI.renderDashboardGrid(machines);
    UI.updateClock();
}

async function openDashboardAlarm(id) {
    const mc = await API.fetchMachineData(id);
    if(!mc) return;

    document.getElementById('alarmBody').innerHTML = '';
    document.getElementById('alarmBadge').innerText = '0';
    document.getElementById('alarmBadge').style.display = 'none';

    // ดึง History มาโชว์ใน Alarm Modal
    const history = generateHistoryData(mc, 50);
    history.forEach(row => {
        row.volts.forEach((v, idx) => { if (Math.abs(v - mc.stdV) > CONFIG.ALARM_TOLERANCE) UI.addAlarmLog(row.timeStr, 'Volt', idx+1, v, mc.stdV); });
        row.amps.forEach((a, idx) => { if (Math.abs(a - mc.stdA) > CONFIG.ALARM_TOLERANCE) UI.addAlarmLog(row.timeStr, 'Amp', idx+1, a, mc.stdA); });
    });
    UI.showAlarmModalDirectly();
}

// --- Monitor Logic ---
async function openMonitor(id) {
    if (dashboardInterval) clearInterval(dashboardInterval);
    currentMachineId = id;
    
    // เคลียร์ค่าหน้าจอ
    document.getElementById('historyBody').innerHTML = '';
    document.getElementById('alarmBody').innerHTML = '';
    document.getElementById('recent-alarms-body').innerHTML = ''; 
    document.getElementById('alarmBadge').innerText = '0';
    document.getElementById('alarmBadge').style.display = 'none';

    UI.toggleView('monitor');
    
    const dummyData = await API.fetchMachineData(id); 
    if(!dummyData) {
        alert("Machine Not Found!"); // แจ้งเตือนถ้าใส่ ID มั่วใน URL
        return;
    }

    lastLotName = dummyData.lot; 

    // Update Header
    document.getElementById('monitor-title').innerHTML = `<i class="bi bi-cpu me-2"></i>${dummyData.name}`;
    document.getElementById('detail-lot').value = dummyData.lot;
    document.getElementById('detail-spec').value = dummyData.spec;
    document.getElementById('stdVolt').value = dummyData.stdV.toFixed(2);
    document.getElementById('stdAmp').value = dummyData.stdA.toFixed(2);

    // Initial Data & Graph
    const historyData = generateHistoryData(dummyData, CONFIG.HISTORY_ROWS);
    UI.fillHistoryTable(historyData, dummyData);

    // Check Alarm History
    historyData.slice().reverse().forEach(row => {
        row.volts.forEach((v, idx) => { if (Math.abs(v - dummyData.stdV) > CONFIG.ALARM_TOLERANCE) UI.addRecentAlarm(row.timeStr, 'Volt', idx+1, v, dummyData.stdV); });
        row.amps.forEach((a, idx) => { if (Math.abs(a - dummyData.stdA) > CONFIG.ALARM_TOLERANCE) UI.addRecentAlarm(row.timeStr, 'Amp', idx+1, a, dummyData.stdA); });
    });

    Charts.initCharts();
    const historyAvgV = historyData.map(h => calculateAverage(h.volts));
    const historyAvgA = historyData.map(h => calculateAverage(h.amps));
    Charts.updateCharts(historyAvgV, historyAvgA);

    if (monitorInterval) clearInterval(monitorInterval);
    monitorInterval = setInterval(runMonitorLoop, CONFIG.MONITOR_INTERVAL);
}

async function runMonitorLoop() {
    if (!currentMachineId) return;
    const data = await API.fetchMachineData(currentMachineId);
    if (!data) return;

    // --- CHECK LOT CHANGE ---
    if (data.lot !== lastLotName) {
        document.getElementById('detail-lot').value = data.lot;
        
        // ถ้าเป็น Lot ใหม่ (และไม่ใช่จบ Lot) ให้ล้างกราฟ
        if (data.lot !== "LOT ENDED" && data.mode === "run") {
            console.log("New Lot Started! Resetting Data...");
            document.getElementById('historyBody').innerHTML = '';
            document.getElementById('alarmBody').innerHTML = '';
            document.getElementById('recent-alarms-body').innerHTML = '';
            Charts.initCharts();
        }
        lastLotName = data.lot;
    }

    const timeStr = formatDateTime(new Date());

    UI.prependHistoryRow(timeStr, data.volts, data.amps, data, (time, type, ch, val, std) => {
        UI.addAlarmLog(time, type, ch, val, std);
        UI.addRecentAlarm(time, type, ch, val, std);
    });

    const avgV = parseFloat(calculateAverage(data.volts));
    const avgA = parseFloat(calculateAverage(data.amps));
    Charts.updateCharts([avgV], [avgA]); 

    document.getElementById('current-avg-volt').innerText = avgV.toFixed(2);
    document.getElementById('current-avg-amp').innerText = avgA.toFixed(2);
}

function backToDashboard() {
    clearInterval(monitorInterval);
    currentMachineId = null;
    UI.toggleView('dashboard');
    startDashboard();
}

// --- Export System ---
function initExportSystem() {
    const machineSelect = document.getElementById('export-machine-select');
    const lotSelect = document.getElementById('export-lot-select');
    const btnDownload = document.getElementById('btn-confirm-export');
    const exportModal = document.getElementById('exportModal');

    if(!machineSelect || !exportModal) return; // ป้องกัน Error ถ้ายังไม่ได้แก้ HTML

    exportModal.addEventListener('show.bs.modal', () => {
        machineSelect.innerHTML = '<option value="" disabled selected>-- Choose Machine --</option>';
        allMachinesCache.forEach(mc => {
            const opt = document.createElement('option');
            opt.value = mc.id;
            opt.textContent = mc.name;
            machineSelect.appendChild(opt);
        });
        lotSelect.innerHTML = '<option value="" disabled selected>-- Choose Lot --</option>';
        lotSelect.disabled = true;
        btnDownload.disabled = true;
    });

    machineSelect.addEventListener('change', async () => {
        const id = machineSelect.value;
        lotSelect.disabled = true;
        lotSelect.innerHTML = '<option>Loading...</option>';
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/lots/${id}`);
            const lots = await res.json();
            lotSelect.innerHTML = '<option value="" disabled selected>-- Choose Lot --</option>';
            lots.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.lot_no;
                opt.textContent = l.lot_no;
                lotSelect.appendChild(opt);
            });
            lotSelect.disabled = false;
        } catch(e) {
            console.error(e);
            lotSelect.innerHTML = '<option>Error loading lots</option>';
        }
    });

    lotSelect.addEventListener('change', () => {
        btnDownload.disabled = false;
    });

    btnDownload.addEventListener('click', async () => {
        const id = machineSelect.value;
        const lot = lotSelect.value;
        const machineName = machineSelect.options[machineSelect.selectedIndex].text;

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/export/${id}/${lot}`);
            const data = await res.json();
            if(data.length === 0) { alert("No data found"); return; }

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Data");
            XLSX.writeFile(wb, `${machineName}_${lot}.xlsx`);
            
            const modalInstance = bootstrap.Modal.getInstance(exportModal);
            modalInstance.hide();
        } catch(e) {
            console.error(e);
            alert("Export Failed");
        }
    });
}

// Start App
init();