// js/utils.js

export function generateMockValues(machine) {
    if (machine.mode === 'stop') return { v: 0, a: 0 };
    const noise = () => (Math.random() * machine.noiseLevel * 2) - machine.noiseLevel;
    return {
        v: parseFloat((machine.stdV + noise()).toFixed(2)),
        a: parseFloat((machine.stdA + noise()).toFixed(2))
    };
}

// --- แก้ไขตรงนี้: เพิ่มวันที่และเวลา ---
export function formatDateTime(date) {
    return date.toLocaleString('th-TH', { 
        year: '2-digit', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
    });
}

// สร้าง History สำหรับใช้ตอนเริ่ม
export function generateHistoryData(machine, count = 60) {
    const history = [];
    const now = Date.now();
    for (let i = count - 1; i >= 0; i--) {
        const time = new Date(now - (i * 1000));
        const volts = [];
        const amps = [];
        for(let ch=0; ch<6; ch++) {
            const val = generateMockValues(machine);
            volts.push(val.v);
            amps.push(val.a);
        }
        history.push({
            // ใช้ function ใหม่
            timeStr: formatDateTime(time),
            volts: volts,
            amps: amps
        });
    }
    return history;
}
export function exportTableToExcel(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;

    // 1. แปลง HTML Table เป็น Workbook
    const wb = XLSX.utils.table_to_book(table, { sheet: "Machine Data" });

    // 2. สั่งดาวน์โหลดไฟล์
    XLSX.writeFile(wb, filename);
}

export function calculateAverage(arr) {
    if (!arr || !arr.length) return 0;
    return (arr.reduce((a, b) => parseFloat(a) + parseFloat(b), 0) / arr.length).toFixed(2);
}