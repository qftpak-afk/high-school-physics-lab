# High School Physics Lab

การทดลองฟิสิกส์ระดับมัธยมปลายแบบ 3 มิติ แยกตามสาขาของฟิสิกส์

## รันระหว่างพัฒนา

```bash
npx serve public     # แล้วเปิด http://localhost:3000
npm test             # unit test ของฟิสิกส์ (node --test)
```

ต้องเปิดผ่าน local server เพราะใช้ ES modules และต้องต่ออินเทอร์เน็ตเพื่อโหลด three.js และฟอนต์จาก CDN

## โครงสร้าง

```
public/                      # โฟลเดอร์เดียวที่ deploy
├── index.html               # หน้ารวมการทดลอง สร้างการ์ดจาก labs.js
├── labs.js                  # รายชื่อสาขาและการทดลองทั้งหมด
├── shared/
│   ├── lab.css              # token สี ฟอนต์ แผงขั้นตอน ปุ่ม ตาราง
│   └── lab-core.js          # createScene (ฉาก กล้อง ป้าย คลิก/ลาก ลูป) และ createPanel (แผงขั้นตอน)
└── labs/<สาขา>/<การทดลอง>/
    ├── index.html
    ├── physics.js           # ฟังก์ชันล้วน ไม่แตะ DOM มี unit test ใน tests/
    └── main.js              # สถานะ S, STEPS, ok, AUTO, ฉากอุปกรณ์ และ frame()
tests/                       # node --test
```

## เพิ่มการทดลองใหม่

1. คัดลอกโฟลเดอร์การทดลองที่ใกล้เคียงไปเป็น `public/labs/<สาขา>/<ชื่อการทดลอง>/`
2. เขียน `physics.js` เป็นฟังก์ชันล้วน และเพิ่ม test ใน `tests/`
3. ใน `main.js` เรียก `createScene()` สร้างอุปกรณ์ แล้วส่ง `STEPS`, `ok`, `AUTO` เข้า `createPanel()` ปุ่มต้องแก้แค่ค่าใน `S` แล้วให้ `frame()` ขยับฉากตาม เพราะการกระโดดข้ามขั้นอาศัยแนวทางนี้
4. เพิ่ม 1 รายการใน `labs.js`
5. ทดสอบทุกขั้นบนจอคอมพิวเตอร์และมือถือ

## เวอร์ชัน

แก้เลขที่ `public/shared/version.js` ที่เดียว เลขจะแสดงที่หน้ารวมและทุกหน้าการทดลอง เพิ่มการทดลองหรือความสามารถใหม่ให้ขึ้น MINOR แก้บั๊กให้ขึ้น PATCH

## Deploy

push ขึ้น `main` แล้ว GitHub Actions จะรัน `npm test` และ deploy โฟลเดอร์ `public/` ขึ้น GitHub Pages ให้เอง (`.github/workflows/pages.yml`)
