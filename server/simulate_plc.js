const ModbusRTU = require("modbus-serial");

// ตั้งค่า Server
const vector = {
    getInputRegister: function(addr, unitID) { return addr; },
    getHoldingRegister: function(addr, unitID) { return getRegisterValue(addr); },
    getCoil: function(addr, unitID) { return addr % 2 === 0; },
    setRegister: function(addr, value, unitID) { 
        console.log("Write to register:", addr, value); 
        return; 
    },
    setCoil: function(addr, value, unitID) { return; }
};

// จำลองหน่วยความจำ (Memory) เริ่มต้นที่ 0 ถึง 3000
const registers = new Array(3000).fill(0);

// --- CONFIGURATION ---
const PORT = 8502; // ใช้ Port นี้จำลอง
const ADDR_VOLT = 2000;
const ADDR_AMP = 2001;
const ADDR_LOT = 2002;

// ค่าเริ่มต้น
let simVolt = 15.43;
let simAmp = 6.28;
const lotString = "66825A0003";

// Helper: เขียน String ลง Register
function writeStringToRegisters(startAddr, str) {
    const buffer = Buffer.from(str, 'ascii'); // แปลง Text เป็น Byte
    for (let i = 0; i < buffer.length; i += 2) {
        let val = 0;
        if (i + 1 < buffer.length) {
            // รวม 2 char เป็น 1 register (Big Endian)
            val = (buffer[i] << 8) | buffer[i + 1];
        } else {
            // กรณีตัวสุดท้ายเศษ
            val = (buffer[i] << 8);
        }
        registers[startAddr + (i / 2)] = val;
    }
}

// Helper: อ่านค่าจาก Memory
function getRegisterValue(addr) {
    return registers[addr] || 0;
}

// --- MAIN LOOP (จำลองการทำงานเครื่องจักร) ---
setInterval(() => {
    // 1. จำลองค่า Volt/Amp แกว่งนิดหน่อย (Noise)
    // Volt: 12.00 +/- 0.5
    const currentVolt = simVolt + (Math.random() * 1.0 - 0.5);
    // Amp: 5.00 +/- 0.2
    const currentAmp = simAmp + (Math.random() * 0.4 - 0.2);

    // 2. เขียนลง Register (คูณ 100 เพื่อทำเป็น Integer เหมือน PLC จริง)
    registers[ADDR_VOLT] = Math.round(currentVolt * 100);
    registers[ADDR_AMP] = Math.round(currentAmp * 100);

    // 3. เขียน Lot ลง Register (Static)
    writeStringToRegisters(ADDR_LOT, lotString);

    // Log ดูว่าค่าเปลี่ยนไหม
    process.stdout.write(`\r[SIMULATOR] Running... Volt: ${currentVolt.toFixed(2)} V | Amp: ${currentAmp.toFixed(2)} A | Lot: ${lotString}`);
}, 1000);

// --- START SERVER ---
const serverTCP = new ModbusRTU.ServerTCP(vector, { host: "0.0.0.0", port: PORT, debug: true, unitID: 1 });

console.log(`=========================================`);
console.log(`PLC SIMULATOR Started on Port: ${PORT}`);
console.log(`Address ${ADDR_VOLT}: Volt`);
console.log(`Address ${ADDR_AMP}: Amp`);
console.log(`Address ${ADDR_LOT}: Lot String`);
console.log(`=========================================`);