export const CONFIG = {
    // True = จำลองข้อมูล, False = ดึง API จริง
    USE_MOCK_DATA: false, 

    // URL ของ Backend (ถ้าใช้จริงให้เปลี่ยนตรงนี้)
    API_BASE_URL: '/api', 
    
    // ตั้งค่าเวลา Refresh (ms)
    DASHBOARD_INTERVAL: 1000,
    MONITOR_INTERVAL: 1000,
    
    // ตั้งค่า Limit ข้อมูล
    HISTORY_ROWS: 20,
    ALARM_TOLERANCE: 0.5,
    
    // สี
    COLORS: {
        VOLT: { line: '#198754', fill: 'rgba(25,135,84,0.1)' },
        AMP: { line: '#0d6efd', fill: 'rgba(13,110,253,0.1)' }
    }
};