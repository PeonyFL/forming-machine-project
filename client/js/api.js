import { CONFIG } from './config.js';
import { generateMockValues } from './utils.js';

// --- MOCK DATABASE ---
const MOCK_MACHINES = [
    // แผนก Forming
    { id: 1, department: 'forming', name: "MC-01 (Forming)", mode: "run", lot: "LOT-A001", spec: "PCB-X1", stdV: 12.0, stdA: 5.0, noiseLevel: 0.2 },
    { id: 2, department: 'forming', name: "MC-02 (Forming)", mode: "run", lot: "LOT-A002", spec: "PCB-X2", stdV: 12.0, stdA: 5.0, noiseLevel: 0.8 },
    { id: 3, department: 'forming', name: "MC-03 (Forming)",  mode: "run", lot: "LOT-B105", spec: "PCB-Y1", stdV: 24.0, stdA: 10.0, noiseLevel: 0.1 },
    { id: 4, department: 'forming', name: "MC-04 (Forming)",  mode: "stop", lot: "-", spec: "-", stdV: 0, stdA: 0, noiseLevel: 0 },
    
    // แผนก Packing (เพิ่มใหม่)
    { id: 5, department: 'tapping', name: "TAPPING-01 ()", mode: "run", lot: "TAP-01", spec: "STD-BOX", stdV: 220.0, stdA: 2.5, noiseLevel: 0.3 },
    { id: 6, department: 'tapping', name: "TAPPING-02 ()", mode: "stop", lot: "-", spec: "-", stdV: 0, stdA: 0, noiseLevel: 0 }
];

export async function fetchAllMachines() {
    if (CONFIG.USE_MOCK_DATA) {
        return new Promise(resolve => {
            const data = MOCK_MACHINES.map(mc => {
                const vals = generateMockValues(mc);
                return { ...mc, currentV: vals.v, currentA: vals.a };
            });
            resolve(data);
        });
    } else {
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/machines`);
            return await res.json();
        } catch (err) {
            console.error("API Error:", err);
            return [];
        }
    }
}

export async function fetchMachineData(id) {
    if (CONFIG.USE_MOCK_DATA) {
        return new Promise(resolve => {
            const mc = MOCK_MACHINES.find(m => m.id === id);
            if (!mc) resolve(null);
            const volts = [], amps = [];
            for(let i=0; i<6; i++) {
                const v = generateMockValues(mc);
                volts.push(v.v);
                amps.push(v.a);
            }
            resolve({ ...mc, volts, amps });
        });
    } else {
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/machines/${id}/live`);
            return await res.json();
        } catch (err) {
            console.error("API Error:", err);
            return null;
        }
    }
}