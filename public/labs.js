/* รายการสาขาและการทดลองทั้งหมด แก้ที่ไฟล์นี้ที่เดียว
   หน้ารวมสร้างการ์ดจากรายการนี้ และแสดงเฉพาะสาขาที่มีการทดลองแล้ว
   เส้นทางของการทดลอง: /labs/<branch>/<slug>/ (อย่าย้ายสาขาหลังแจกลิงก์แล้ว)

   ช่องของแต่ละการทดลอง
   slug, title, branch, course, minutes, summary   ต้องมี
   titleEn    ชื่อภาษาอังกฤษ แสดงใต้ชื่อบนการ์ด
   activity   เลขกิจกรรมที่แสดงบนการ์ด
   steps      จำนวนขั้นตอน
   thumb      true ถ้ามีภาพ thumb.svg ในโฟลเดอร์การทดลอง (สัดส่วน 320×120)
   soon       true ระหว่างยังพัฒนาไม่เสร็จ การ์ดจะแสดงแต่กดเข้าไม่ได้ */

export const BRANCHES = [
  {slug: "mechanics", name: "กลศาสตร์"},
  {slug: "thermal", name: "ความร้อนและอุณหพลศาสตร์"},
  {slug: "waves", name: "คลื่นและเสียง"},
  {slug: "optics", name: "แสงและทัศนศาสตร์"},
  {slug: "electromagnetism", name: "ไฟฟ้าและแม่เหล็ก"},
  {slug: "atomic", name: "ฟิสิกส์อะตอม"},
  {slug: "nuclear", name: "ฟิสิกส์นิวเคลียร์และอนุภาค"}
];

export const LABS = [
  {
    slug: "spectrum",
    title: "สเปกตรัมของแก๊สร้อน",
    titleEn: "Spectra of Hot Gases",
    branch: "atomic",
    course: "ว33206 ฟิสิกส์ 6",
    minutes: 50,
    steps: 7,
    thumb: true,
    summary: "มองหลอดบรรจุแก๊สผ่านเกรตติง อ่านตำแหน่งเส้นสเปกตรัมบนไม้เมตร แล้วคำนวณความยาวคลื่นจาก λ = d sinθ"
  },
  {
    slug: "photoelectric",
    title: "ปรากฏการณ์โฟโตอิเล็กทริก",
    titleEn: "Photoelectric Effect",
    branch: "atomic",
    course: "ว33206 ฟิสิกส์ 6",
    minutes: 100,
    steps: 9,
    thumb: true,
    summary: "วัดศักย์หยุดยั้งของหลอดโฟโตเซลล์ที่ความถี่แสงต่าง ๆ แล้วหาค่าคงตัวของพลังค์จากความชันของกราฟ Vₛ กับ f"
  },
  {
    slug: "radioactive-decay",
    title: "การสลายตัวของกัมมันตภาพรังสี",
    titleEn: "Radioactive Decay",
    branch: "nuclear",
    course: "ว33206 ฟิสิกส์ 6",
    minutes: 50,
    steps: 8,
    thumb: true,
    summary: "นับรังสีด้วยเครื่องนับไกเกอร์ หักรังสีพื้นหลัง แล้วหาครึ่งชีวิตของสารจากความชันของกราฟ ln(N − B) กับ t"
  }
];

export const labPath = lab => `labs/${lab.branch}/${lab.slug}/`;
