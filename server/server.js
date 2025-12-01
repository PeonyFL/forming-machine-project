const express = require('express');
const cors = require('cors');
const ModbusRTU = require("modbus-serial");
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));

const PORT = 3000;
const POLLING_RATE = 60000; // อ่านทุก 1 วินาที (ปรับเป็น 60000 ได้ถ้าต้องการ)

// ตั้งค่า IP ให้ตรงกับ PLC หรือ Simulator
const MACHINES_CONFIG = [
    { id: 1, name: "MC-01 (Forming)", ip: "127.0.0.1", port: 8502, department: "forming", spec: "STD-X" },
    { id: 2, name: "MC-02 (Forming)", ip: "127.0.0.1", port: 8502, department: "forming", spec: "STD-Y" },
    // เพิ่มเครื่องอื่นๆ...
];

let globalData = {};

MACHINES_CONFIG.forEach(mc => {
    globalData[mc.id] = {
        ...mc,
        mode: "stop",
        lot: "CONNECTING...",
        stdV: 0, stdA: 0,
        currentV: 0, currentA: 0,
        volts: [0,0,0,0,0,0],
        amps: [0,0,0,0,0,0],
        lastUpdate: new Date()
    };
});

function registersToString(registers) {
    let result = "";
    for (let i = 0; i < registers.length; i++) {
        const val = registers[i];
        if (val === 0) continue;
        if (val >= 0 && val <= 9) result += val.toString();
        else result += String.fromCharCode(val);
    }
    return result.trim();
}

class MachineConnection {
    constructor(config) {
        this.config = config;
        this.client = new ModbusRTU();
        this.connect();
    }

    connect() {
        console.log(`[${this.config.name}] Connecting...`);
        this.client.connectTCP(this.config.ip, { port: this.config.port })
            .then(() => {
                console.log(`[${this.config.name}] Connected!`);
                this.client.setID(1);
                this.readLoop();
            })
            .catch((e) => {
                console.error(`[${this.config.name}] Err: ${e.message}`);
                globalData[this.config.id].mode = "stop";
                setTimeout(() => this.connect(), 5000);
            });
    }

    readLoop() {
        // อ่านยาวตั้งแต่ 2000 ถึง 2040 (41 Registers)
        this.client.readHoldingRegisters(2000, 41)
            .then((data) => {
                const regs = data.data;
                const dataStore = globalData[this.config.id];

                // 1. เช็คสถานะจบ Lot (Address 2040 -> Index 40)
                const lotStatus = regs[40]; 

                // ถ้า 2040 = 1 -> RUNNING, ถ้า 0 -> STOPPED
                if (lotStatus === 1) {
                    dataStore.mode = "run";
                } else {
                    dataStore.mode = "stop";
                }

                // 2. Standard (2000, 2001)
                dataStore.stdV = parseFloat((regs[0] / 100).toFixed(2));
                dataStore.stdA = parseFloat((regs[1] / 100).toFixed(2));

                // 3. Lot No (2002-2016)
                if (lotStatus === 0) {
                    dataStore.lot = "LOT ENDED";
                } else {
                    dataStore.lot = registersToString(regs.slice(2, 17));
                }

                // 4. Actual Volt (2020-2025)
                const rawVolts = regs.slice(20, 26);
                dataStore.volts = rawVolts.map(r => parseFloat((r / 100).toFixed(2)));

                // 5. Actual Amp (2026-2031)
                const rawAmps = regs.slice(26, 32);
                dataStore.amps = rawAmps.map(r => parseFloat((r / 100).toFixed(2)));

                // 6. Average
                const sumV = dataStore.volts.reduce((a, b) => a + b, 0);
                const sumA = dataStore.amps.reduce((a, b) => a + b, 0);
                dataStore.currentV = parseFloat((sumV / 6).toFixed(2));
                dataStore.currentA = parseFloat((sumA / 6).toFixed(2));

                dataStore.lastUpdate = new Date();
            })
            .catch((e) => {
                console.error(`[${this.config.name}] Read Error: ${e.message}`);
                globalData[this.config.id].mode = "stop";
            })
            .finally(() => {
                setTimeout(() => this.readLoop(), POLLING_RATE);
            });
    }
}

MACHINES_CONFIG.forEach(config => new MachineConnection(config));

// API Endpoints
app.get('/api/machines', (req, res) => {
    res.json(Object.values(globalData));
});

app.get('/api/machines/:id/live', (req, res) => {
    const id = parseInt(req.params.id);
    const mc = globalData[id];
    if (!mc) return res.status(404).json({ error: "Not found" });
    res.json(mc);
});

// Serve Frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});