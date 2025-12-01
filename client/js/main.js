import { CONFIG } from './config.js';
import * as API from './api.js';
import * as UI from './ui.js';
import * as Charts from './charts.js';
import { calculateAverage, generateHistoryData, formatDateTime, exportTableToExcel } from './utils.js';

let dashboardInterval = null;
let monitorInterval = null;
let currentMachineId = null;
let lastLotName = ""; // <--- เพิ่มตัวแปรจำชื่อ Lot ล่าสุด

function init() {
    UI.toggleView('dashboard');
    startDashboard();
    
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
    
    document.getElementById('btn-export').addEventListener('click', () => {
        if (!currentMachineId) return;
        const dateStr = new Date().toISOString().slice(0,19).replace(/[-:T]/g,"");
        const filename = `Machine_${currentMachineId}_Export_${dateStr}.xlsx`;
        exportTableToExcel('history-table', filename);
    });
}

function startDashboard() {
    runDashboardLoop();
    if (dashboardInterval) clearInterval(dashboardInterval);
    dashboardInterval = setInterval(runDashboardLoop, CONFIG.DASHBOARD_INTERVAL);
}

async function runDashboardLoop() {
    const machines = await API.fetchAllMachines();
    UI.renderDashboardGrid(machines);
    UI.updateClock();
}

async function openDashboardAlarm(id) {
    const mc = await API.fetchMachineData(id);
    if(!mc) return;

    document.getElementById('alarmBody').innerHTML = '';
    document.getElementById('alarmBadge').innerText = '0';
    document.getElementById('alarmBadge').style.display = 'none';

    const history = generateHistoryData(mc, 50);
    history.forEach(row => {
        row.volts.forEach((v, idx) => { if (Math.abs(v - mc.stdV) > CONFIG.ALARM_TOLERANCE) UI.addAlarmLog(row.timeStr, 'Volt', idx+1, v, mc.stdV); });
        row.amps.forEach((a, idx) => { if (Math.abs(a - mc.stdA) > CONFIG.ALARM_TOLERANCE) UI.addAlarmLog(row.timeStr, 'Amp', idx+1, a, mc.stdA); });
    });
    UI.showAlarmModalDirectly();
}

async function openMonitor(id) {
    clearInterval(dashboardInterval);
    currentMachineId = id;
    
    // เคลียร์ค่า UI
    document.getElementById('historyBody').innerHTML = '';
    document.getElementById('alarmBody').innerHTML = '';
    document.getElementById('recent-alarms-body').innerHTML = ''; 
    document.getElementById('alarmBadge').innerText = '0';
    document.getElementById('alarmBadge').style.display = 'none';

    UI.toggleView('monitor');
    
    const dummyData = await API.fetchMachineData(id); 
    if(!dummyData) return;

    // จำชื่อ Lot เริ่มต้นไว้เช็ค
    lastLotName = dummyData.lot; 

    document.getElementById('monitor-title').innerHTML = `<i class="bi bi-cpu me-2"></i>${dummyData.name}`;
    document.getElementById('detail-lot').value = dummyData.lot;
    document.getElementById('detail-spec').value = dummyData.spec;
    document.getElementById('stdVolt').value = dummyData.stdV.toFixed(2);
    document.getElementById('stdAmp').value = dummyData.stdA.toFixed(2);

    // Gen History เริ่มต้น
    const historyData = generateHistoryData(dummyData, CONFIG.HISTORY_ROWS);
    UI.fillHistoryTable(historyData, dummyData);

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

    // ============================================================
    // CHECK LOT CHANGE: ถ้าชื่อ Lot เปลี่ยน ให้ล้างกราฟใหม่
    // ============================================================
    // ถ้า Lot ใหม่ ไม่ตรงกับอันเดิม และอันเดิมไม่ใช่ "LOT ENDED" (กรณีเพิ่งจบงาน)
    if (data.lot !== lastLotName) {
        // อัปเดต Input บนหน้าจอ
        document.getElementById('detail-lot').value = data.lot;
        
        // ถ้าเป็นการเริ่ม Lot ใหม่ (ไม่ใช่แค่เปลี่ยนเป็น STOPPED/ENDED)
        // ให้เคลียร์กราฟเพื่อให้ข้อมูลสะอาด
        if (data.lot !== "LOT ENDED" && data.mode === "run") {
            console.log("New Lot Started! Resetting Data...");
            
            // ล้างข้อมูลเก่า
            document.getElementById('historyBody').innerHTML = '';
            document.getElementById('alarmBody').innerHTML = '';
            document.getElementById('recent-alarms-body').innerHTML = '';
            
            // รีเซ็ตกราฟ
            Charts.initCharts();
        }
        
        // จำชื่อใหม่
        lastLotName = data.lot;
    }
    // ============================================================

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

init();