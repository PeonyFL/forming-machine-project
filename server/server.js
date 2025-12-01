// 1. เรียกใช้ dotenv เป็นบรรทัดแรก
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const ModbusRTU = require("modbus-serial");
const path = require('path');
const db = require('./db');

const app = express();
app.use(cors());

// Serve Frontend Files
app.use(express.static(path.join(__dirname, '../client')));

// 2. ดึงค่าจาก ENV (ถ้าไม่มีให้ใช้ค่า Default ด้านหลัง ||)
const PORT = process.env.PORT || 3000;
const POLLING_RATE = parseInt(process.env.POLLING_RATE) || 60000;
const PLC_PORT = parseInt(process.env.PLC_PORT) || 502;

// 3. Config เครื่องจักร (ดึง IP จาก ENV)
const MACHINES_CONFIG = [
    { 
        id: 1, 
        name: "MC-01 (Forming)", 
        ip: process.env.PLC_IP_MC01 || "127.0.0.1", 
        port: PLC_PORT, 
        department: "forming", 
        spec: "STD-X" 
    }
];

let globalData = {};

// Init Data Store
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
        console.log(`[${this.config.name}] Connecting to ${this.config.ip}...`);
        this.client.connectTCP(this.config.ip, { port: this.config.port })
            .then(() => {
                console.log(`[${this.config.name}] Connected!`);
                this.client.setID(1);
                this.readLoop();
            })
            .catch((e) => {
                console.error(`[${this.config.name}] Connection Error: ${e.message}`);
                globalData[this.config.id].mode = "stop";
                setTimeout(() => this.connect(), 5000);
            });
    }

    readLoop() {
        // อ่านยาวถึง 2040 (เพื่อเช็คสถานะจบ Lot)
        this.client.readHoldingRegisters(2000, 41)
            .then((data) => {
                const regs = data.data;
                const dataStore = globalData[this.config.id];

                // 1. เช็คสถานะจบ Lot (2040)
                const lotStatus = regs[40]; 
                if (lotStatus === 1) {
                    dataStore.mode = "run";
                } else {
                    dataStore.mode = "stop";
                }

                // 2. Standard
                dataStore.stdV = parseFloat((regs[0] / 100).toFixed(2));
                dataStore.stdA = parseFloat((regs[1] / 100).toFixed(2));

                // 3. Lot No
                if (lotStatus === 0) {
                    dataStore.lot = "LOT ENDED";
                } else {
                    dataStore.lot = registersToString(regs.slice(2, 17));
                }

                // 4. Actual Data
                dataStore.volts = regs.slice(20, 26).map(r => parseFloat((r / 100).toFixed(2)));
                dataStore.amps = regs.slice(26, 32).map(r => parseFloat((r / 100).toFixed(2)));

                // 5. Average
                const sumV = dataStore.volts.reduce((a, b) => a + b, 0);
                const sumA = dataStore.amps.reduce((a, b) => a + b, 0);
                dataStore.currentV = parseFloat((sumV / 6).toFixed(2));
                dataStore.currentA = parseFloat((sumA / 6).toFixed(2));

                // 6. Save DB (เฉพาะตอน Run)
                if (dataStore.mode === 'run') {
                    db.insertLog(dataStore);
                    console.log(`[${this.config.name}] Saved DB: ${dataStore.lot}`);
                }

                dataStore.lastUpdate = new Date();
            })
            .catch((e) => {
                console.error(`[${this.config.name}] Read Error: ${e.message}`);
                globalData[this.config.id].mode = "stop";
            })
            .finally(() => {
                // ใช้ POLLING_RATE จาก env
                setTimeout(() => this.readLoop(), POLLING_RATE);
            });
    }
}

// Start Connections
MACHINES_CONFIG.forEach(config => new MachineConnection(config));

// --- API ---
app.get('/api/machines', (req, res) => {
    res.json(Object.values(globalData));
});

app.get('/api/machines/:id/live', (req, res) => {
    const id = parseInt(req.params.id);
    const mc = globalData[id];
    if (!mc) return res.status(404).json({ error: "Not found" });
    res.json(mc);
});

// API สำหรับ Export Excel
app.get('/api/lots/:id', (req, res) => {
    db.getLotsByMachine(parseInt(req.params.id), (rows) => res.json(rows));
});

app.get('/api/export/:id/:lot', (req, res) => {
    db.getDataByLot(parseInt(req.params.id), req.params.lot, (rows) => res.json(rows));
});

// Fallback Route: ส่งหน้าเว็บ
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Polling every ${POLLING_RATE} ms`);
});