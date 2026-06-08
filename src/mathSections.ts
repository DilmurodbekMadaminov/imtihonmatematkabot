import { MathSection } from './types';

export const mathSections: MathSection[] = [
  {
    id: 'algebra',
    title: 'Algebra',
    description: 'Sonli to\'plamlar, tenglamalar, tengsizliklar, ko\'rsatkichli va logarifmik funksiyalar',
    variants: [
      {
        title: 'Algebra - 1-Variant',
        questions: [
          {
            id: 1001,
            text: 'Tenglamani yeching: log₃(x² - 6) = log₃(x)',
            options: ['3', '-2', '3 va -2', 'yechimi yo\'q'],
            correct: 0
          },
          {
            id: 1002,
            text: 'Arifmetik progressiyada a₃ = 9 va a₇ = 21 bo\'lsa, uning ayirmasi d ni toping.',
            options: ['2', '3', '4', '5'],
            correct: 1
          },
          {
            id: 1003,
            text: 'Geometrik progressiyada b₁ = 2 va q = 3 bo\'lsa, dastlabki 4 ta hadi yig\'indisini toping.',
            options: ['40', '80', '120', '160'],
            correct: 1
          },
          {
            id: 1004,
            text: 'Soddalashtiring: (x² - 4) / (x - 2)',
            options: ['x - 2', 'x + 2', 'x + 4', 'x - 4'],
            correct: 1
          },
          {
            id: 1005,
            text: 'Ko\'rsatkichli tenglamani yeching: 2^(x+2) + 2^x = 20',
            options: ['1', '2', '3', '4'],
            correct: 1
          },
          {
            id: 1006,
            text: 'Yig\'indini hisoblang: √12 + √27 - √48',
            options: ['√3', '2√3', '3√3', '4√3'],
            correct: 0
          },
          {
            id: 1007,
            text: 'Tengsizlikni yeching: x² - 5x + 6 < 0',
            options: ['(2; 3)', '[2; 3]', '(-∞; 2) U (3; ∞)', '(-∞; 2] U [3; ∞)'],
            correct: 0
          },
          {
            id: 1008,
            text: 'f(x) = 3x² - 5x + 2 funksiyaning x₀ = 2 nuqtadagi qiymatini toping.',
            options: ['3', '4', '5', '6'],
            correct: 1
          },
          {
            id: 1009,
            text: 'Hisoblang: 27^(2/3) - 16^(3/4)',
            options: ['1', '2', '0', '3'],
            correct: 1
          },
          {
            id: 1010,
            text: 'Tenglamalar sistemasini yeching va x+y ni toping:\n{ x + y = 7\n{ x * y = 12',
            options: ['7', '12', '1', '5'],
            correct: 0
          }
        ]
      },
      {
        title: 'Algebra - 2-Variant',
        questions: [
          {
            id: 1011,
            text: 'log₅(2x - 3) = 2 bo\'lsa, x ni toping.',
            options: ['10', '14', '12', '13'],
            correct: 1
          },
          {
            id: 1012,
            text: 'Kvadrat tenglamaning diskriminantini toping: 2x² - 5x + 2 = 0',
            options: ['9', '16', '25', '1'],
            correct: 0
          },
          {
            id: 1013,
            text: 'Aka va ukaning yoshlari yig\'indisi 28 da. Aka ukasidan 4 yosh katta. Ukaning yoshini toping.',
            options: ['10', '12', '14', '16'],
            correct: 1
          },
          {
            id: 1014,
            text: 'Soddalashtiring: (a³ - b³) / (a - b)',
            options: ['a² - ab + b²', 'a² + ab + b²', 'a² + 2ab + b²', 'a² - 2ab + b²'],
            correct: 1
          },
          {
            id: 1015,
            text: 'Ko\'rsatkichli tengsizlikni yeching: 3^(x-1) > 9',
            options: ['x > 3', 'x > 2', 'x < 3', 'x < 2'],
            correct: 0
          }
        ]
      }
    ]
  },
  {
    id: 'geometriya',
    title: 'Geometriya',
    description: 'Planimetriya, stereometriya, shakllarning yuzasi, hajmi va fazoviy qonuniyatlar',
    variants: [
      {
        title: 'Geometriya - 1-Variant',
        questions: [
          {
            id: 2001,
            text: 'To\'g\'ri burchakli uchburchakning katetlari 6 cm va 8 cm bo\'lsa, gipotenuzaga tushirilgan balandlikni toping.',
            options: ['4.8 cm', '5 cm', '4.5 cm', '5.2 cm'],
            correct: 0
          },
          {
            id: 2002,
            text: 'Muntazam oltiburchakning ichki burchaklari yig\'indisini toping.',
            options: ['540°', '720°', '900°', '1080°'],
            correct: 1
          },
          {
            id: 2003,
            text: 'Doiraning radiusi 2 marta orttirilsa, uning yuzi necha marta ortadi?',
            options: ['2 marta', '4 marta', '8 marta', 'o\'zgarmaydi'],
            correct: 1
          },
          {
            id: 2004,
            text: 'Konusning balandligi 4 cm, asosi radiusi 3 cm bo\'lsa, uning hajmini toping.',
            options: ['12π cm³', '36π cm³', '16π cm³', '24π cm³'],
            correct: 0
          },
          {
            id: 2005,
            text: 'Uchburchakning ikki tomoni 5 cm va 7 cm ga teng. Uchinchi tomonining eng katta butun qiymatini toping.',
            options: ['11 cm', '12 cm', '13 cm', '10 cm'],
            correct: 0
          },
          {
            id: 2006,
            text: 'Kvadrat diagonalining uzunligi d = 6√2 bo\'lsa, uning yuzini toping.',
            options: ['18', '36', '72', '24'],
            correct: 1
          },
          {
            id: 2007,
            text: 'Tsilindrning o\'q kesimi tomoni 10 cm bo\'lgan kvadrat. Tsilindr yon sirti yuzini toping.',
            options: ['50π cm²', '100π cm²', '200π cm²', '25π cm²'],
            correct: 1
          },
          {
            id: 2008,
            text: 'Trapetsiyaning asoslari 8 cm va 12 cm, balandligi 6 cm bo\'lsa, uning yuzini toping.',
            options: ['120 cm²', '60 cm²', '48 cm²', '96 cm²'],
            correct: 1
          },
          {
            id: 2009,
            text: 'Shar yuzasi 36π bo\'lsa, shar hajmini toping.',
            options: ['36π', '18π', '72π', '12π'],
            correct: 0
          },
          {
            id: 2010,
            text: 'To\'g\'ri burchakli uchburchakning o\'tkir burchaklaridan biri 35° bo\'lsa, ikkinchi o\'tkir burchakni toping.',
            options: ['55°', '45°', '35°', '65°'],
            correct: 0
          }
        ]
      }
    ]
  },
  {
    id: 'trigonometriya',
    title: 'Trigonometriya',
    description: 'Trigonometrik funksiyalar, ayniyatlar, grafiklar, trigonometrik tenglamalar',
    variants: [
      {
        title: 'Trigonometriya - 1-Variant',
        questions: [
          {
            id: 3001,
            text: 'Hisoblang: sin²(15°) + cos²(15°)',
            options: ['0.5', '1', '√3/2', 'yechimi yo\'q'],
            correct: 1
          },
          {
            id: 3002,
            text: 'Yassi burchak ostida ifodalang: cos(π - α)',
            options: ['cos(α)', '-cos(α)', 'sin(α)', '-sin(α)'],
            correct: 1
          },
          {
            id: 3003,
            text: 'Tenglamani yeching: sin(x) = 1/2',
            options: [
              'x = (-1)^k * π/6 + πk, k∈Z',
              'x = ±π/6 + 2πk, k∈Z',
              'x = (-1)^k * π/3 + πk, k∈Z',
              'x = π/6 + 2πk, k∈Z'
            ],
            correct: 0
          },
          {
            id: 3004,
            text: 'Soddalashtiring: 1 - sin²(α) + cos²(α)',
            options: ['2cos²(α)', '2sin²(α)', '1', '0'],
            correct: 0
          },
          {
            id: 3005,
            text: 'Agar cos(α) = 3/5 va α ∈ (3π/2; 2π) bo\'lsa, sin(α) ning qiymatini toping.',
            options: ['4/5', '-4/5', '3/4', '-3/4'],
            correct: 1
          }
        ]
      }
    ]
  },
  {
    id: 'matematik_analiz',
    title: 'Matematik Analiz',
    description: 'Hosilalar, boshlang\'ich funksiya va integral, funksiya tekshirish',
    variants: [
      {
        title: 'Matematik Analiz - 1-Variant',
        questions: [
          {
            id: 4001,
            text: 'Funksiyaning hosilasini toping: f(x) = x³ - 3x² + 5x - 2',
            options: ['3x² - 6x + 5', 'x² - 3x + 5', '3x² - 6x', '3x³ - 6x² + 5'],
            correct: 0
          },
          {
            id: 4002,
            text: 'f(x) = sin(2x) funksiyaning hosilasini toping.',
            options: ['cos(2x)', '2cos(2x)', '-2cos(2x)', '2sin(2x)'],
            correct: 1
          },
          {
            id: 4003,
            text: 'Integrallang: ∫ (2x + 1) dx',
            options: ['x² + x + C', '2x² + x + C', 'x² + C', 'x² - x + C'],
            correct: 0
          },
          {
            id: 4004,
            text: 'f(x) = e^(3x) funksiyaning boshlang\'ich funksiyasini toping.',
            options: ['e^(3x) + C', '3e^(3x) + C', '(1/3)e^(3x) + C', 'e^x + C'],
            correct: 2
          },
          {
            id: 4005,
            text: 'f(x) = x² - 4x + 3 funksiyaning ekstremum (minimum) nuqtasini toping.',
            options: ['x = 1', 'x = 2', 'x = 3', 'x = 4'],
            correct: 1
          }
        ]
      }
    ]
  }
];
