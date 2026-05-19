# Chemical Stock Control System (v2.0 Mobile-First)

ระบบเว็บแอปพลิเคชันแบบ Serverless สำหรับบริหารจัดการคลังสารเคมี (Chemical Warehouse) รองรับการควบคุมการรับเข้า-เบิกจ่าย (IN/OUT Transactions) การควบคุมวันผลิต/วันหมดอายุ (MFG/EXP) พร้อมระบบบีบอัดและจัดเก็บรูปภาพในตัว ออกแบบตามหลัก Mobile-First รองรับการใช้งานบนมือถือ หน้างาน 100%

## 🚀 Tech Stack & Architecture
- **Frontend Architecture:** Single Page Logic per View, Static Web Hosting (Hosted on GitHub Pages)
- **UI Framework:** Bootstrap 5.3.3 & Bootstrap Icons (SVG Font)
- **Data Visualization:** Chart.js (Doughnut Chart)
- **Backend & Database:** Supabase (PostgreSQL) Integration via Serverless JS Client SDK
- **Design Pattern:** Desktop Table View / Mobile Cards Layout Switcher

---

## 📁 Project Structure
โปรเจกต์แยกโครงสร้างไฟล์ออกเป็นโมดูลอย่างชัดเจน เพื่อให้ง่ายต่อการบำรุงรักษา (Maintainability):

```text
chemical-stock-control/
│
├── README.md               # ไฟล์อธิบายภาพรวมโปรเจกต์สำหรับนักพัฒนา และ AI Context
├── index.html              # หน้าหลัก: ระบบจัดการสต็อก (CRUD) และปุ่มทำรายการ รับ/จ่าย
├── transaction.html        # หน้าประวัติ: แสดงบันทึกธุรกรรม รับเข้า-เบิกจ่าย ทั้งหมดในระบบ
├── dashboard.html          # หน้าสรุปผล: แสดงการคำนวณ KPI คลัง และกราฟสถิติสัดส่วนจัดเก็บ
│
├── css/
│   └── theme.css           # Custom CSS สำหรับควบคุมธีมองค์กร, Sidebar และสไตล์ Mobile UX
│
└── js/
    ├── script.js           # Logic หลักหน้าคลัง: การเชื่อมต่อ Supabase, CRUD, Image Compression
    ├── transaction.js      # Logic หน้าประวัติ: ทำการ Query แบบ Relational Join ตารางธุรกรรม
    └── dashboard.js        # Logic หน้าแดชบอร์ด: ประมวลผลสถิติ และวาดกราฟผ่าน Chart.js
