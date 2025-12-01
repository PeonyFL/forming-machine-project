import { CONFIG } from './config.js';

let voltChart = null;
let ampChart = null;

const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false, // ปิด Animation เพื่อประสิทธิภาพสูงสุด
    interaction: {
        mode: 'index',
        intersect: false,
    },
    plugins: { 
        legend: { display: false },
        tooltip: { enabled: true } 
    },
    scales: { 
        x: { display: false }, 
        y: { beginAtZero: false } 
    },
    elements: { 
        line: { tension: 0.3, borderWidth: 2 }, 
        point: { radius: 2, hitRadius: 10 } 
    } 
};

// ฟังก์ชันทำลายกราฟเก่า (ป้องกันกราฟซ้อนกัน)
export function destroyCharts() {
    if (voltChart) {
        voltChart.destroy();
        voltChart = null;
    }
    if (ampChart) {
        ampChart.destroy();
        ampChart = null;
    }
}

export function initCharts() {
    // 1. ทำลายของเก่าก่อนเสมอ
    destroyCharts();

    const vCtx = document.getElementById('voltChart');
    const aCtx = document.getElementById('ampChart');

    if (vCtx && aCtx) {
        // สร้าง Labels เปล่าๆ รอไว้ตามจำนวน HISTORY_ROWS (เช่น 20 ช่อง)
        const labels = Array(CONFIG.HISTORY_ROWS).fill('');
        
        // 2. สร้างกราฟ Volt
        voltChart = new Chart(vCtx, { 
            type: 'line', 
            data: { 
                labels: labels, 
                datasets: [{ 
                    data: [], // เริ่มต้นว่างๆ เดี๋ยวรอ updateCharts เติมค่า
                    borderColor: CONFIG.COLORS.VOLT.line, 
                    backgroundColor: CONFIG.COLORS.VOLT.fill, 
                    fill: true 
                }] 
            }, 
            options: commonOptions 
        });

        // 3. สร้างกราฟ Amp
        ampChart = new Chart(aCtx, { 
            type: 'line', 
            data: { 
                labels: labels, 
                datasets: [{ 
                    data: [], 
                    borderColor: CONFIG.COLORS.AMP.line, 
                    backgroundColor: CONFIG.COLORS.AMP.fill, 
                    fill: true 
                }] 
            }, 
            options: commonOptions 
        });
    } else {
        console.error("Chart Canvas element not found!");
    }
}

export function updateCharts(volts, amps) {
    // เช็คความปลอดภัย
    if (!voltChart || !ampChart) return;
    if (!volts || !amps) return;

    // ดึงค่า Limit จาก Config (อย่าใช้เลข 60 หรือ 20 ตรงๆ)
    const limit = CONFIG.HISTORY_ROWS;

    // --- อัปเดต Volt ---
    if (volts.length > 6) {
        // กรณี: รับข้อมูลประวัติ (History Array) มาทับเลย
        // ตัดให้เหลือแค่ Limit ล่าสุด
        const slicedData = volts.slice(-limit); 
        voltChart.data.datasets[0].data = slicedData;
    } else if (volts.length > 0) {
        // กรณี: รับข้อมูล Realtime (1-6 ค่า) มาหาค่าเฉลี่ย
        const avg = volts.reduce((a,b)=>a+b, 0) / volts.length;
        
        // Push ค่าใหม่
        voltChart.data.datasets[0].data.push(avg);
        
        // Shift (ลบค่าเก่า) ถ้าเกิน Limit
        if (voltChart.data.datasets[0].data.length > limit) {
            voltChart.data.datasets[0].data.shift();
        }
    }
    // สั่ง update แบบ 'none' เพื่อไม่ให้มี animation (ลดภาระเครื่อง)
    voltChart.update('none');

    // --- อัปเดต Amp (Logic เดียวกัน) ---
    if (amps.length > 6) {
        const slicedData = amps.slice(-limit);
        ampChart.data.datasets[0].data = slicedData;
    } else if (amps.length > 0) {
        const avg = amps.reduce((a,b)=>a+b, 0) / amps.length;
        ampChart.data.datasets[0].data.push(avg);
        if (ampChart.data.datasets[0].data.length > limit) {
            ampChart.data.datasets[0].data.shift();
        }
    }
    ampChart.update('none');
}