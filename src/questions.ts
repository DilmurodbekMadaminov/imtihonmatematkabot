export interface Question {
  id: number;
  text: string;
  imageUrl?: string;
  options: string[];
  correct: number;
}

export const questions: Question[] = [
  { id: 1, text: "Toshbaqa 1 minutda 2 metr yo'l bosadi. 150 metrni necha soatda bosib o'tadi.", options: ["1 soat", "1,25 soat", "1,5 soat", "2 soat"], correct: 1 },
  { id: 2, text: "Toshbaqa 1 minutda 2 metr yo'l bosadi. 420 metrni necha soatda bosib o'tadi.", options: ["1 soat", "1,25 soat", "1,5 soat", "3,5 soat"], correct: 3 },
  { id: 3, text: "Shilliqqurt 1 minutda 0,5 metr masofani bosib o'tsa, 20 metrni qancha vaqtda bosib o'tadi.", options: ["30", "40", "20", "10"], correct: 1 },
  { id: 4, text: "a sonining 36 % i, 108 ning 24 % iga teng. a sonini toping.", options: ["36", "108", "72", "54"], correct: 2 },
  { id: 5, text: "14 ga bo'linadigan ikki xonali sonlar nechta?", options: ["6 ta", "8 ta", "9 ta", "7 ta"], correct: 3 },
  { id: 6, text: "Nechta ikki xonali son 50 ning bo'luvchisi bo'ladi?", options: ["2", "3", "4", "5"], correct: 1 },
  { id: 7, text: "Gul do'konida qizil atirguldan 3 xil guldasta va oq atirguldan 2 xil guldasta yasalgan. Bu guldastalardan 1 tasini olishning nechta usuli bor?", options: ["4", "5", "9", "12"], correct: 1 },
  { id: 8, text: "Gul do'konida qizil atirguldan 4 xil guldasta va oq atirguldan 2 xil guldasta yasalgan. Bu guldastalardan 1 tasini olishning nechta usuli bor?", options: ["8", "60", "6", "12"], correct: 2 },
  { id: 9, text: "Savatda 3 xil 3 dona meva bor. Ularni tokchaga necha xil usulda taxlasa bo'ladi?", options: ["5", "6", "4", "8"], correct: 1 },
  { id: 10, text: "Nigina opa qulupnayli murabbo tayyorlash uchun 1 kg qulupnayga 1,25 kg shakar soladi. 9 kg qulupnayli murabbo tayyorlash uchun necha kg qulupnay va necha kg shakar kerak bo'ladi?", options: ["3; 6", "4; 5", "7; 2", "4; 6"], correct: 1 },
  { id: 11, text: "Rasmda muntazam uchburchak va kvadrat berilgan. Kvadratning yuzi 36 ga teng bo'lsa, uchburchakning perimetrini toping.", options: ["18", "16", "24", "12"], correct: 0 },
  { id: 12, text: "Rasmda muntazam uchburchak va kvadrat berilgan. Kvadratning yuzi 4 ga teng bo'lsa, uchburchakning yuzini toping.", options: ["√3", "2√3", "4√3", "3"], correct: 0 },
  { id: 13, text: "Rasmda muntazam uchburchak va kvadrat berilgan. Kvadratning yuzi 4 ga teng bo'lsa, uchburchakning perimetrini toping.", options: ["6", "8", "10", "12"], correct: 0 },
  { id: 14, text: "2 ta sonning yig'indisi 220 ga teng. Ularning nisbati 10 ga teng bo'lsa, shu sonlarning musbat ayirmasini toping.", options: ["160", "170", "180", "190"], correct: 2 },
  { id: 15, text: "2 ta sonning yig'indisi 220 ga teng. Ularning nisbati 9 ga teng bo'lsa, shu sonlarning eng kattasini toping.", options: ["200", "198", "196", "194"], correct: 1 },
  { id: 16, text: "a, b natural sonlar uchun a + b/2 = 100 tenglik o'rinli bo'lsa, a + b ning eng katta qiymatini toping.", options: ["200", "250", "300", "199"], correct: 3 },
  { id: 17, text: "Aka ukasidan 10 yosh katta va ularning yoshlari nisbati 3:1 kabi. Necha yildan so'ng ularning yoshlari nisbati 2:1 nisbatda bo'ladi?", options: ["4", "5", "10", "8"], correct: 1 },
  { id: 18, text: "Mahsulotning narxi 55000 so'm edi. Agar mahsulot narxi 44000 so'mga tushirilsa, mahsulot uchun necha foiz chegirma bo'lgan?", options: ["11%", "20%", "25%", "40%"], correct: 1 },
  { id: 19, text: "Ko'paytuvchilarga ajrating: 6ab²c - 18abc", options: ["6ab(c - 3)", "6abc(b - 2)", "6abc(b - 3)", "abc(b - 18)"], correct: 2 },
  { id: 20, text: "Ko'paytuvchilarga ajrating: 8abc² - 16abc", options: ["8ab(c - 3)", "8abc(c - 2)", "8abc(c - 3)", "abc(b - 18)"], correct: 1 },
  { id: 21, text: "Tomonlari 5, 5, 6 cm bo'lgan parallelepipedning to'la sirtining yuzini toping.", options: ["150", "180", "170", "200"], correct: 2 },
  { id: 22, text: "10 cm³ hajmlik idishga necha litr suv ketadi?", options: ["0,01", "0,1", "1", "10"], correct: 0 },
  { id: 23, text: "200 litr necha (dm³) ga teng.", options: ["0,2", "200", "2", "20"], correct: 1 },
  { id: 24, text: "Kubning qirrasi 8 ga teng. Kub hajmini toping.", options: ["512", "256", "128", "64"], correct: 0 },
  { id: 25, text: "Shunday sonni topingki, u sonni 19 ga ko'paytirib, 9 ni ayirsa 200 ga teng bo'lsin.", options: ["13", "12", "11", "14"], correct: 2 },
  { id: 26, text: "Teng yonli uchburchakda AC = BC ≠ AB bo'lsa, uchburchakning qaysi burchaklari teng.", options: ["∠A = ∠C", "∠A = ∠B", "∠B = ∠C", "∠A = ∠C = ∠B"], correct: 1 },
  { id: 27, text: "(-13)² + 14 · (-12) ni hisoblang.", options: ["2", "3", "-1", "1"], correct: 3 },
  { id: 28, text: "(-12)² - 11 · 12 ni hisoblang.", options: ["-12", "310", "-276", "12"], correct: 3 },
  { id: 29, text: "Sport zalda 8 ta O'zbekistonlik, 10 ta Qozog'istonlik sportchilar bor. Musobaqaga 1 ta o'zbek va 1 ta qozoq sportchilarini necha xil usulda tanlab olish mumkin.", options: ["40", "80", "36", "72"], correct: 1 },
  { id: 30, text: "To'g'ri burchakli parallelepipedning qirralari 3, 4, 5 cm ga teng. Parallelepipedning eng katta yoq yuzini toping.", options: ["12", "10", "7,5", "20"], correct: 3 },
  { id: 31, text: "To'g'ri burchakli parallelepipedning qirralari 6, 8, 10 cm ga teng Parallelepipedning eng katta yoq yuzini toping.", options: ["80", "36", "48", "30"], correct: 0 },
  { id: 32, text: "Tog'ri burchakli uchburchakning katetlari 3 va 4 ga teng. Uchburchak yuzini toping.", options: ["12", "3", "6", "24"], correct: 2 },
  { id: 33, text: "Akbar 2 litrlik murabboni sig'imi 50 cm³ bo'lgan nechta idishga quyadi?", options: ["12", "36", "24", "40"], correct: 3 },
  { id: 34, text: "Soddalashtiring: (2a² - 6a³) · 2a", options: ["4a³ - 12a⁴", "4a² + 12a⁴", "4a⁴ - 12a³", "12a⁴ - 4a³"], correct: 0 },
  { id: 35, text: "Soddalashtiring: (2a² + 6a) : 2a", options: ["a + 2", "3 - a", "a + 3", "a + 4"], correct: 2 },
  { id: 36, text: "3 - √7 soniga qarama-qarshi sonni toping.", options: ["-√7 + 3", "-3 + √7", "7 - √3", "-7 + √3"], correct: 1 },
  { id: 37, text: "2(x - 3) + 7 = 2x tenglamani yeching.", options: ["2", "∅", "4", "5"], correct: 1 },
  { id: 38, text: "2(x + 3) - 5 = 1 - (x - 1) tenglamani yeching.", options: ["1", "2/3", "3", "1/3"], correct: 3 },
  { id: 39, text: "2/11 davriy kasrning verguldan keyingi 50-o'rinda turgan raqamini toping.", options: ["1", "8", "4", "6"], correct: 1 },
  { id: 40, text: "Hajmi 8 m³ ga teng bo'lgan kubning sirtini bo'yash uchun 1 m² ga 250 ml bo'yoq ketsa, kubning to'la sirtini bo'yash uchun necha litr bo'yoq ketadi?", options: ["6000", "600", "60", "6"], correct: 3 },
  { id: 41, text: "Agar a + b = 320, a/b = 39 tengliklar berilgan bo'lsa, a - b ning qiymatini toping.", options: ["299", "302", "304", "307"], correct: 2 },
  { id: 42, text: "Agar a + b = 64, a/b = 7 tengliklar berilgan bo'lsa, a - b ning qiymatini toping.", options: ["48", "32", "24", "36"], correct: 0 },
  { id: 43, text: "Soddalashtiring: (x + 2) · (x² - 2x + 4) - 4", options: ["x³ + 4", "x³ - 4", "x³ + 8", "x³ - 8"], correct: 0 },
  { id: 44, text: "Soddalashtiring: (x - 2) · (x² + 2x + 4) + 4", options: ["x³ + 4", "x³ - 4", "x³ + 8", "x³ - 8"], correct: 1 },
  { id: 45, text: "Soddalashtiring: a(b - c) - b(c - a) - c(a - b)", options: ["2ab + 2ac", "2b - 2ac", "4ab - 2ac", "2ab - 2ac"], correct: 3 },
  { id: 46, text: "25 gacha bo'lgan tub sonlar yig'indisini toping.", options: ["114", "100", "144", "99"], correct: 1 },
  { id: 47, text: "30 dan 50 gacha bo'lgan tub sonlar yig'indisini toping.", options: ["160", "199", "94", "200"], correct: 1 },
  { id: 48, text: "Aylanadagi A, B, C va D nuqtalardan foydalanib, nechta vatar o'tkazish mumkin?", options: ["7 ta", "4 ta", "6 ta", "12 ta"], correct: 2 },
  { id: 49, text: "Agar x = 8,25 va y = -2,25 bo'lsa, x² - y² ning qiymatini hisoblang.", options: ["64", "63", "60", "54"], correct: 1 },
  { id: 50, text: "Agar x = 7,25 va y = 1,75 bo'lsa, x² - y² ning qiymatini hisoblang.", options: ["32", "30", "34", "49,5"], correct: 3 }
];

export const variants = [
  questions.slice(0, 10),
  questions.slice(10, 20),
  questions.slice(20, 30),
  questions.slice(30, 40),
  questions.slice(40, 50)
];
