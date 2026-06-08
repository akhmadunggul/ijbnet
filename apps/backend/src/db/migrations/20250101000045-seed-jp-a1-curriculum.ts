import { QueryInterface } from 'sequelize';

const NOW = new Date('2026-01-01T00:00:00Z');

// ── ID helpers ────────────────────────────────────────────────────────────────
const T = (n: number) => `b0000001-0000-4001-a000-${String(n).padStart(12, '0')}`;
const L = (n: number) => `b0000002-0000-4001-a000-${String(n).padStart(12, '0')}`;
const E = (n: number) => `b0000003-0000-4001-a000-${String(n).padStart(12, '0')}`;

// ── Topics ────────────────────────────────────────────────────────────────────
const TOPICS = [
  { id: T(1), sortOrder: 1, emoji: '👋', titleJa: 'はじめまして',          titleId: 'Perkenalan & Salam',       descriptionJa: '日本語のあいさつと自己紹介を学びます。', descriptionId: 'Belajar salam dan perkenalan diri dalam bahasa Jepang.' },
  { id: T(2), sortOrder: 2, emoji: '🕐', titleJa: 'すうじ・じかん',        titleId: 'Angka & Waktu',            descriptionJa: '数字と時間の表現を学びます。',         descriptionId: 'Belajar angka dan ekspresi waktu.' },
  { id: T(3), sortOrder: 3, emoji: '🏭', titleJa: 'しごとのことば',        titleId: 'Kosakata Kerja',           descriptionJa: '職場でよく使う言葉を学びます。',       descriptionId: 'Belajar kosakata yang sering digunakan di tempat kerja.' },
  { id: T(4), sortOrder: 4, emoji: '🛒', titleJa: 'かいもの',              titleId: 'Belanja',                  descriptionJa: '買い物で使う表現を学びます。',         descriptionId: 'Belajar ekspresi untuk berbelanja.' },
  { id: T(5), sortOrder: 5, emoji: '📍', titleJa: 'ばしょ・ほうこう',      titleId: 'Tempat & Arah',            descriptionJa: '場所や方向を示す言葉を学びます。',     descriptionId: 'Belajar kata-kata untuk menunjukkan tempat dan arah.' },
  { id: T(6), sortOrder: 6, emoji: '🍱', titleJa: 'たべもの・すきなもの',  titleId: 'Makanan & Preferensi',     descriptionJa: '食べ物と好みの表現を学びます。',       descriptionId: 'Belajar kosakata makanan dan mengungkapkan kesukaan.' },
].map((t) => ({ ...t, level: 'A1', createdAt: NOW, updatedAt: NOW }));

// ── Lessons ───────────────────────────────────────────────────────────────────
const LESSONS = [
  { id: L(1),  topicId: T(1), sortOrder: 1, type: 'vocabulary', titleJa: '単語カード',  titleId: 'Kartu Kosakata' },
  { id: L(2),  topicId: T(1), sortOrder: 2, type: 'quiz',       titleJa: 'クイズ',      titleId: 'Kuis' },
  { id: L(3),  topicId: T(2), sortOrder: 1, type: 'vocabulary', titleJa: '単語カード',  titleId: 'Kartu Kosakata' },
  { id: L(4),  topicId: T(2), sortOrder: 2, type: 'quiz',       titleJa: 'クイズ',      titleId: 'Kuis' },
  { id: L(5),  topicId: T(3), sortOrder: 1, type: 'vocabulary', titleJa: '単語カード',  titleId: 'Kartu Kosakata' },
  { id: L(6),  topicId: T(3), sortOrder: 2, type: 'quiz',       titleJa: 'クイズ',      titleId: 'Kuis' },
  { id: L(7),  topicId: T(4), sortOrder: 1, type: 'vocabulary', titleJa: '単語カード',  titleId: 'Kartu Kosakata' },
  { id: L(8),  topicId: T(4), sortOrder: 2, type: 'quiz',       titleJa: 'クイズ',      titleId: 'Kuis' },
  { id: L(9),  topicId: T(5), sortOrder: 1, type: 'vocabulary', titleJa: '単語カード',  titleId: 'Kartu Kosakata' },
  { id: L(10), topicId: T(5), sortOrder: 2, type: 'quiz',       titleJa: 'クイズ',      titleId: 'Kuis' },
  { id: L(11), topicId: T(6), sortOrder: 1, type: 'vocabulary', titleJa: '単語カード',  titleId: 'Kartu Kosakata' },
  { id: L(12), topicId: T(6), sortOrder: 2, type: 'quiz',       titleJa: 'クイズ',      titleId: 'Kuis' },
].map((l) => ({ ...l, createdAt: NOW, updatedAt: NOW }));

// ── Exercises ─────────────────────────────────────────────────────────────────

type CardData = { front: { text: string; romaji: string }; back: { meaning: string; example: string; exampleMeaning: string } };
type QuizData = { question: string; options: { value: string; label: string }[]; correct: string; explanation: string };

function card(id: number, lessonId: string, sortOrder: number, data: CardData) {
  return { id: E(id), lessonId, sortOrder, type: 'card', dataJson: data, createdAt: NOW, updatedAt: NOW };
}
function quiz(id: number, lessonId: string, sortOrder: number, data: QuizData) {
  return { id: E(id), lessonId, sortOrder, type: 'quiz', dataJson: data, createdAt: NOW, updatedAt: NOW };
}

const EXERCISES = [
  // ── Topic 1: はじめまして — Vocabulary ─────────────────────────────────────
  card(101, L(1), 1, { front: { text: 'おはようございます', romaji: 'Ohayou gozaimasu' },      back: { meaning: 'Selamat pagi (formal)', example: 'おはようございます！', exampleMeaning: 'Selamat pagi!' } }),
  card(102, L(1), 2, { front: { text: 'こんにちは',         romaji: 'Konnichiwa' },             back: { meaning: 'Halo / Selamat siang', example: 'こんにちは、お元気ですか？', exampleMeaning: 'Halo, apa kabar?' } }),
  card(103, L(1), 3, { front: { text: 'こんばんは',         romaji: 'Konbanwa' },               back: { meaning: 'Selamat malam', example: 'こんばんは！', exampleMeaning: 'Selamat malam!' } }),
  card(104, L(1), 4, { front: { text: 'はじめまして',       romaji: 'Hajimemashite' },          back: { meaning: 'Perkenalkan (saat pertama bertemu)', example: 'はじめまして、田中です。', exampleMeaning: 'Perkenalkan, saya Tanaka.' } }),
  card(105, L(1), 5, { front: { text: 'ありがとうございます', romaji: 'Arigatou gozaimasu' },   back: { meaning: 'Terima kasih (formal)', example: 'ありがとうございます！', exampleMeaning: 'Terima kasih!' } }),
  card(106, L(1), 6, { front: { text: 'すみません',         romaji: 'Sumimasen' },              back: { meaning: 'Permisi / Maaf', example: 'すみません、ちょっといいですか？', exampleMeaning: 'Permisi, boleh sebentar?' } }),
  card(107, L(1), 7, { front: { text: 'わたしは〜です',     romaji: 'Watashi wa ~ desu' },      back: { meaning: 'Saya adalah ~', example: 'わたしはアフマドです。', exampleMeaning: 'Saya adalah Ahmad.' } }),
  card(108, L(1), 8, { front: { text: 'よろしくおねがいします', romaji: 'Yoroshiku onegaishimasu' }, back: { meaning: 'Mohon bimbingannya', example: 'はじめまして、よろしくおねがいします。', exampleMeaning: 'Perkenalkan, mohon bimbingannya.' } }),

  // ── Topic 1 — Quiz ──────────────────────────────────────────────────────────
  quiz(111, L(2), 1, { question: '「おはようございます」はいつ使いますか？', options: [{ value: 'a', label: 'Pagi hari' }, { value: 'b', label: 'Siang hari' }, { value: 'c', label: 'Malam hari' }, { value: 'd', label: 'Tengah malam' }], correct: 'a', explanation: '「おはようございます」は朝（午前10時ごろまで）に使うあいさつです。' }),
  quiz(112, L(2), 2, { question: '「はじめまして」はどんなときに使いますか？', options: [{ value: 'a', label: 'Saat pertama kali bertemu' }, { value: 'b', label: 'Saat berpisah' }, { value: 'c', label: 'Saat makan' }, { value: 'd', label: 'Saat kerja selesai' }], correct: 'a', explanation: '「はじめまして」は初対面のときに使います。' }),
  quiz(113, L(2), 3, { question: '「ありがとうございます」の意味は？', options: [{ value: 'a', label: 'Terima kasih' }, { value: 'b', label: 'Permisi' }, { value: 'c', label: 'Selamat siang' }, { value: 'd', label: 'Selamat tinggal' }], correct: 'a', explanation: '「ありがとうございます」は感謝を伝えるときに使います。' }),
  quiz(114, L(2), 4, { question: '「すみません」の意味は？', options: [{ value: 'a', label: 'Permisi / Maaf' }, { value: 'b', label: 'Selamat pagi' }, { value: 'c', label: 'Terima kasih' }, { value: 'd', label: 'Selamat tinggal' }], correct: 'a', explanation: '「すみません」は人に声をかけるとき、または謝るときに使います。' }),
  quiz(115, L(2), 5, { question: '「はじめまして」の後に何を言いますか？', options: [{ value: 'a', label: 'よろしくおねがいします' }, { value: 'b', label: 'ありがとうございます' }, { value: 'c', label: 'おやすみなさい' }, { value: 'd', label: 'いただきます' }], correct: 'a', explanation: '「はじめまして、よろしくおねがいします」はセットで使います。' }),
  quiz(116, L(2), 6, { question: '「こんばんは」はいつ使いますか？', options: [{ value: 'a', label: 'Malam hari' }, { value: 'b', label: 'Pagi hari' }, { value: 'c', label: 'Siang hari' }, { value: 'd', label: 'Saat bekerja' }], correct: 'a', explanation: '「こんばんは」は夕方から夜にかけて使うあいさつです。' }),

  // ── Topic 2: すうじ・じかん — Vocabulary ───────────────────────────────────
  card(201, L(3), 1, { front: { text: 'いち・に・さん', romaji: 'Ichi / Ni / San' },           back: { meaning: '1 / 2 / 3', example: 'いち、に、さん！', exampleMeaning: 'Satu, dua, tiga!' } }),
  card(202, L(3), 2, { front: { text: 'し・ご・ろく',   romaji: 'Shi / Go / Roku' },            back: { meaning: '4 / 5 / 6', example: 'し、ご、ろく。', exampleMeaning: 'Empat, lima, enam.' } }),
  card(203, L(3), 3, { front: { text: 'しち・はち・きゅう・じゅう', romaji: 'Shichi / Hachi / Kyuu / Juu' }, back: { meaning: '7 / 8 / 9 / 10', example: 'じゅうかいぎ。', exampleMeaning: 'Rapat ke-10.' } }),
  card(204, L(3), 4, { front: { text: 'なんじですか？',  romaji: 'Nanji desu ka?' },             back: { meaning: 'Jam berapa sekarang?', example: 'いまなんじですか？', exampleMeaning: 'Sekarang jam berapa?' } }),
  card(205, L(3), 5, { front: { text: '〜じ',            romaji: '~ji' },                        back: { meaning: 'Jam ~ (o\'clock)', example: 'はちじです。', exampleMeaning: 'Jam 8.' } }),
  card(206, L(3), 6, { front: { text: 'ごぜん',          romaji: 'Gozen' },                      back: { meaning: 'AM (sebelum tengah hari)', example: 'ごぜんくじ', exampleMeaning: 'Jam 9 pagi' } }),
  card(207, L(3), 7, { front: { text: 'ごご',             romaji: 'Gogo' },                       back: { meaning: 'PM (setelah tengah hari)', example: 'ごごさんじ', exampleMeaning: 'Jam 3 sore' } }),
  card(208, L(3), 8, { front: { text: 'ふん・ぷん',       romaji: 'Fun / Pun' },                  back: { meaning: 'Menit', example: 'じゅうごふん', exampleMeaning: '15 menit' } }),

  // ── Topic 2 — Quiz ──────────────────────────────────────────────────────────
  quiz(211, L(4), 1, { question: '「ごぜん」は何ですか？', options: [{ value: 'a', label: 'AM (sebelum tengah hari)' }, { value: 'b', label: 'PM (setelah tengah hari)' }, { value: 'c', label: 'Tengah malam' }, { value: 'd', label: 'Tengah hari' }], correct: 'a', explanation: '「ごぜん」は午前、つまり12時より前の時間です。' }),
  quiz(212, L(4), 2, { question: '「なんじですか？」の意味は？', options: [{ value: 'a', label: 'Jam berapa?' }, { value: 'b', label: 'Berapa harganya?' }, { value: 'c', label: 'Di mana?' }, { value: 'd', label: 'Apa ini?' }], correct: 'a', explanation: '「なんじ」は時刻を聞くときの表現です。' }),
  quiz(213, L(4), 3, { question: '「じゅう」は何番ですか？', options: [{ value: 'a', label: '10' }, { value: 'b', label: '9' }, { value: 'c', label: '8' }, { value: 'd', label: '7' }], correct: 'a', explanation: '「じゅう」は10です。いち（1）、に（2）、さん（3）…じゅう（10）。' }),
  quiz(214, L(4), 4, { question: '午後2時は「ごぜん」か「ごご」ですか？', options: [{ value: 'a', label: 'ごご（PM）' }, { value: 'b', label: 'ごぜん（AM）' }, { value: 'c', label: 'どちらでもない' }, { value: 'd', label: 'わからない' }], correct: 'a', explanation: '午後（PM）は「ごご」です。午前（AM）は「ごぜん」。' }),
  quiz(215, L(4), 5, { question: '「はち」は何番ですか？', options: [{ value: 'a', label: '8' }, { value: 'b', label: '6' }, { value: 'c', label: '7' }, { value: 'd', label: '9' }], correct: 'a', explanation: '「はち」は8です。' }),
  quiz(216, L(4), 6, { question: '「ふん」「ぷん」は何を表しますか？', options: [{ value: 'a', label: 'Menit' }, { value: 'b', label: 'Jam' }, { value: 'c', label: 'Detik' }, { value: 'd', label: 'Hari' }], correct: 'a', explanation: '「ふん・ぷん」は「分」、つまり分（menit）を表します。' }),

  // ── Topic 3: しごとのことば — Vocabulary ───────────────────────────────────
  card(301, L(5), 1, { front: { text: 'しごと',           romaji: 'Shigoto' },                   back: { meaning: 'Pekerjaan / Kerja', example: 'しごとはなんですか？', exampleMeaning: 'Apa pekerjaan Anda?' } }),
  card(302, L(5), 2, { front: { text: 'かいしゃ',         romaji: 'Kaisha' },                    back: { meaning: 'Perusahaan / Kantor', example: 'かいしゃにいきます。', exampleMeaning: 'Saya pergi ke kantor.' } }),
  card(303, L(5), 3, { front: { text: 'かいぎ',           romaji: 'Kaigi' },                     back: { meaning: 'Rapat / Meeting', example: 'かいぎがあります。', exampleMeaning: 'Ada rapat.' } }),
  card(304, L(5), 4, { front: { text: 'やすみ',           romaji: 'Yasumi' },                    back: { meaning: 'Hari libur / Istirahat', example: 'あしたはやすみです。', exampleMeaning: 'Besok hari libur.' } }),
  card(305, L(5), 5, { front: { text: 'おつかれさまでした', romaji: 'Otsukaresama deshita' },     back: { meaning: 'Terima kasih atas kerja kerasnya', example: 'おつかれさまでした！', exampleMeaning: 'Terima kasih atas kerja kerasnya!' } }),
  card(306, L(5), 6, { front: { text: 'わかりました',     romaji: 'Wakarimashita' },              back: { meaning: 'Mengerti / Paham', example: 'はい、わかりました。', exampleMeaning: 'Baik, saya mengerti.' } }),
  card(307, L(5), 7, { front: { text: 'おねがいします',   romaji: 'Onegaishimasu' },              back: { meaning: 'Tolong / Mohon bantuannya', example: 'これ、おねがいします。', exampleMeaning: 'Tolong yang ini.' } }),
  card(308, L(5), 8, { front: { text: 'ちょっとまってください', romaji: 'Chotto matte kudasai' }, back: { meaning: 'Mohon tunggu sebentar', example: 'ちょっとまってください。', exampleMeaning: 'Mohon tunggu sebentar.' } }),

  // ── Topic 3 — Quiz ──────────────────────────────────────────────────────────
  quiz(311, L(6), 1, { question: '「かいしゃ」の意味は？', options: [{ value: 'a', label: 'Perusahaan / Kantor' }, { value: 'b', label: 'Rapat' }, { value: 'c', label: 'Pekerjaan' }, { value: 'd', label: 'Hari libur' }], correct: 'a', explanation: '「かいしゃ（会社）」はperusahaan/kantorの意味です。' }),
  quiz(312, L(6), 2, { question: '仕事が終わったとき、同僚に何と言いますか？', options: [{ value: 'a', label: 'おつかれさまでした' }, { value: 'b', label: 'いただきます' }, { value: 'c', label: 'おはようございます' }, { value: 'd', label: 'さようなら' }], correct: 'a', explanation: '「おつかれさまでした」は仕事を終えたときに言います。' }),
  quiz(313, L(6), 3, { question: '「わかりました」の意味は？', options: [{ value: 'a', label: 'Mengerti / Paham' }, { value: 'b', label: 'Tidak mengerti' }, { value: 'c', label: 'Selamat pagi' }, { value: 'd', label: 'Tunggu sebentar' }], correct: 'a', explanation: '「わかりました（分かりました）」はmengertiの意味です。' }),
  quiz(314, L(6), 4, { question: '「かいぎ」の意味は？', options: [{ value: 'a', label: 'Rapat / Meeting' }, { value: 'b', label: 'Kantor' }, { value: 'c', label: 'Pekerjaan' }, { value: 'd', label: 'Hari libur' }], correct: 'a', explanation: '「かいぎ（会議）」はrapat/meetingの意味です。' }),
  quiz(315, L(6), 5, { question: '「やすみ」の意味は？', options: [{ value: 'a', label: 'Hari libur / Istirahat' }, { value: 'b', label: 'Rapat' }, { value: 'c', label: 'Pekerjaan' }, { value: 'd', label: 'Perusahaan' }], correct: 'a', explanation: '「やすみ（休み）」はhari libur/istirahatの意味です。' }),
  quiz(316, L(6), 6, { question: '相手に少し待ってほしいとき、何と言いますか？', options: [{ value: 'a', label: 'ちょっとまってください' }, { value: 'b', label: 'ありがとうございます' }, { value: 'c', label: 'わかりました' }, { value: 'd', label: 'おつかれさまでした' }], correct: 'a', explanation: '「ちょっとまってください」はMohon tunggu sebentarの意味です。' }),

  // ── Topic 4: かいもの — Vocabulary ─────────────────────────────────────────
  card(401, L(7), 1, { front: { text: 'いくらですか？',     romaji: 'Ikura desu ka?' },          back: { meaning: 'Berapa harganya?', example: 'このりんご、いくらですか？', exampleMeaning: 'Apel ini berapa harganya?' } }),
  card(402, L(7), 2, { front: { text: 'ひゃく',             romaji: 'Hyaku' },                   back: { meaning: '100 (seratus)', example: 'ひゃくえん', exampleMeaning: '100 yen' } }),
  card(403, L(7), 3, { front: { text: 'せん',               romaji: 'Sen' },                     back: { meaning: '1.000 (seribu)', example: 'せんえん', exampleMeaning: '1.000 yen' } }),
  card(404, L(7), 4, { front: { text: 'まん',               romaji: 'Man' },                     back: { meaning: '10.000 (sepuluh ribu)', example: 'いちまんえん', exampleMeaning: '10.000 yen' } }),
  card(405, L(7), 5, { front: { text: 'これをください',     romaji: 'Kore wo kudasai' },          back: { meaning: 'Tolong yang ini', example: 'これをひとつください。', exampleMeaning: 'Tolong satu yang ini.' } }),
  card(406, L(7), 6, { front: { text: 'たかい',             romaji: 'Takai' },                   back: { meaning: 'Mahal', example: 'これはたかいですね。', exampleMeaning: 'Ini mahal ya.' } }),
  card(407, L(7), 7, { front: { text: 'やすい',             romaji: 'Yasui' },                   back: { meaning: 'Murah', example: 'これはやすいです！', exampleMeaning: 'Ini murah!' } }),
  card(408, L(7), 8, { front: { text: 'レシートをください', romaji: 'Reshiito wo kudasai' },     back: { meaning: 'Tolong bon/kuitansinya', example: 'レシートをください。', exampleMeaning: 'Tolong kuitansinya.' } }),

  // ── Topic 4 — Quiz ──────────────────────────────────────────────────────────
  quiz(411, L(8), 1, { question: '「いくらですか？」の意味は？', options: [{ value: 'a', label: 'Berapa harganya?' }, { value: 'b', label: 'Jam berapa?' }, { value: 'c', label: 'Di mana?' }, { value: 'd', label: 'Apa ini?' }], correct: 'a', explanation: '「いくら」は値段（harga）を聞くときに使います。' }),
  quiz(412, L(8), 2, { question: '「せん」は何円ですか？', options: [{ value: 'a', label: '1.000円' }, { value: 'b', label: '100円' }, { value: 'c', label: '10.000円' }, { value: 'd', label: '10円' }], correct: 'a', explanation: '「せん（千）」は1,000です。' }),
  quiz(413, L(8), 3, { question: '「たかい」の反対語は？', options: [{ value: 'a', label: 'やすい' }, { value: 'b', label: 'おおきい' }, { value: 'c', label: 'ちいさい' }, { value: 'd', label: 'あたらしい' }], correct: 'a', explanation: '「たかい（高い）」の反対は「やすい（安い）」です。' }),
  quiz(414, L(8), 4, { question: '欲しいものを買いたいとき、何と言いますか？', options: [{ value: 'a', label: 'これをください' }, { value: 'b', label: 'いくらですか' }, { value: 'c', label: 'ありがとうございます' }, { value: 'd', label: 'すみません' }], correct: 'a', explanation: '「これをください」はTolong yang iniの意味です。' }),
  quiz(415, L(8), 5, { question: '「まん」は何円ですか？', options: [{ value: 'a', label: '10.000円' }, { value: 'b', label: '1.000円' }, { value: 'c', label: '100円' }, { value: 'd', label: '1.000.000円' }], correct: 'a', explanation: '「まん（万）」は10,000です。' }),
  quiz(416, L(8), 6, { question: '「やすい」の意味は？', options: [{ value: 'a', label: 'Murah' }, { value: 'b', label: 'Mahal' }, { value: 'c', label: 'Besar' }, { value: 'd', label: 'Baru' }], correct: 'a', explanation: '「やすい（安い）」はmurahの意味です。' }),

  // ── Topic 5: ばしょ・ほうこう — Vocabulary ─────────────────────────────────
  card(501, L(9),  1, { front: { text: 'どこ',    romaji: 'Doko' },     back: { meaning: 'Di mana?', example: 'トイレはどこですか？', exampleMeaning: 'Di mana toilet?' } }),
  card(502, L(9),  2, { front: { text: 'ここ',    romaji: 'Koko' },     back: { meaning: 'Di sini', example: 'ここにいます。', exampleMeaning: 'Saya ada di sini.' } }),
  card(503, L(9),  3, { front: { text: 'そこ',    romaji: 'Soko' },     back: { meaning: 'Di situ (dekat lawan bicara)', example: 'そこにあります。', exampleMeaning: 'Ada di situ.' } }),
  card(504, L(9),  4, { front: { text: 'あそこ',  romaji: 'Asoko' },    back: { meaning: 'Di sana (jauh dari keduanya)', example: 'あそこがかいしゃです。', exampleMeaning: 'Di sana itu kantornya.' } }),
  card(505, L(9),  5, { front: { text: 'みぎ',    romaji: 'Migi' },     back: { meaning: 'Kanan', example: 'みぎにまがってください。', exampleMeaning: 'Tolong belok kanan.' } }),
  card(506, L(9),  6, { front: { text: 'ひだり',  romaji: 'Hidari' },   back: { meaning: 'Kiri', example: 'ひだりにまがってください。', exampleMeaning: 'Tolong belok kiri.' } }),
  card(507, L(9),  7, { front: { text: 'まっすぐ', romaji: 'Massugu' }, back: { meaning: 'Lurus', example: 'まっすぐいってください。', exampleMeaning: 'Tolong jalan lurus.' } }),
  card(508, L(9),  8, { front: { text: 'ちかく',  romaji: 'Chikaku' },  back: { meaning: 'Dekat / Di sekitar sini', example: 'えきのちかく', exampleMeaning: 'Di dekat stasiun' } }),

  // ── Topic 5 — Quiz ──────────────────────────────────────────────────────────
  quiz(511, L(10), 1, { question: '「どこ」の意味は？', options: [{ value: 'a', label: 'Di mana?' }, { value: 'b', label: 'Kapan?' }, { value: 'c', label: 'Apa?' }, { value: 'd', label: 'Siapa?' }], correct: 'a', explanation: '「どこ」は場所を尋ねるときに使います。' }),
  quiz(512, L(10), 2, { question: '「みぎ」の反対は？', options: [{ value: 'a', label: 'ひだり' }, { value: 'b', label: 'まっすぐ' }, { value: 'c', label: 'うしろ' }, { value: 'd', label: 'そこ' }], correct: 'a', explanation: '「みぎ（右）」の反対は「ひだり（左）」です。' }),
  quiz(513, L(10), 3, { question: '自分がいる場所を指すとき、何と言いますか？', options: [{ value: 'a', label: 'ここ' }, { value: 'b', label: 'そこ' }, { value: 'c', label: 'あそこ' }, { value: 'd', label: 'どこ' }], correct: 'a', explanation: '「ここ」は話し手がいる場所を指します。' }),
  quiz(514, L(10), 4, { question: '「まっすぐ」の意味は？', options: [{ value: 'a', label: 'Lurus' }, { value: 'b', label: 'Belok kanan' }, { value: 'c', label: 'Belok kiri' }, { value: 'd', label: 'Putar balik' }], correct: 'a', explanation: '「まっすぐ」はlurus ke depanの意味です。' }),
  quiz(515, L(10), 5, { question: '遠くにあるものを指すとき、何と言いますか？', options: [{ value: 'a', label: 'あそこ' }, { value: 'b', label: 'ここ' }, { value: 'c', label: 'そこ' }, { value: 'd', label: 'どこ' }], correct: 'a', explanation: '「あそこ」は話し手・聞き手両方から遠い場所を指します。' }),
  quiz(516, L(10), 6, { question: '「ちかく」の意味は？', options: [{ value: 'a', label: 'Dekat' }, { value: 'b', label: 'Jauh' }, { value: 'c', label: 'Di sini' }, { value: 'd', label: 'Di sana' }], correct: 'a', explanation: '「ちかく（近く）」はdekatの意味です。' }),

  // ── Topic 6: たべもの・すきなもの — Vocabulary ─────────────────────────────
  card(601, L(11), 1, { front: { text: 'いただきます',         romaji: 'Itadakimasu' },            back: { meaning: 'Selamat makan (sebelum makan)', example: 'いただきます！', exampleMeaning: 'Selamat makan!' } }),
  card(602, L(11), 2, { front: { text: 'ごちそうさまでした',   romaji: 'Gochisousama deshita' },   back: { meaning: 'Terima kasih atas makanannya (setelah makan)', example: 'ごちそうさまでした！', exampleMeaning: 'Terima kasih atas makanannya!' } }),
  card(603, L(11), 3, { front: { text: 'おいしい',             romaji: 'Oishii' },                 back: { meaning: 'Enak / Lezat', example: 'このラーメンはおいしい！', exampleMeaning: 'Ramen ini enak!' } }),
  card(604, L(11), 4, { front: { text: 'からい',               romaji: 'Karai' },                  back: { meaning: 'Pedas', example: 'このカレーはからい。', exampleMeaning: 'Kari ini pedas.' } }),
  card(605, L(11), 5, { front: { text: 'あまい',               romaji: 'Amai' },                   back: { meaning: 'Manis', example: 'このケーキはあまい。', exampleMeaning: 'Kue ini manis.' } }),
  card(606, L(11), 6, { front: { text: 'なにがすきですか？',   romaji: 'Nani ga suki desu ka?' },  back: { meaning: 'Apa yang Anda suka?', example: 'たべものはなにがすきですか？', exampleMeaning: 'Makanan apa yang Anda suka?' } }),
  card(607, L(11), 7, { front: { text: 'すきです',             romaji: 'Suki desu' },              back: { meaning: 'Saya suka', example: 'すしがすきです。', exampleMeaning: 'Saya suka sushi.' } }),
  card(608, L(11), 8, { front: { text: 'きらいです',           romaji: 'Kirai desu' },             back: { meaning: 'Saya tidak suka', example: 'からいたべものがきらいです。', exampleMeaning: 'Saya tidak suka makanan pedas.' } }),

  // ── Topic 6 — Quiz ──────────────────────────────────────────────────────────
  quiz(611, L(12), 1, { question: '食事を始める前に何と言いますか？', options: [{ value: 'a', label: 'いただきます' }, { value: 'b', label: 'ごちそうさまでした' }, { value: 'c', label: 'おいしい' }, { value: 'd', label: 'ありがとうございます' }], correct: 'a', explanation: '「いただきます」は食事の前に言う表現です。' }),
  quiz(612, L(12), 2, { question: '「おいしい」の意味は？', options: [{ value: 'a', label: 'Enak / Lezat' }, { value: 'b', label: 'Pedas' }, { value: 'c', label: 'Manis' }, { value: 'd', label: 'Pahit' }], correct: 'a', explanation: '「おいしい（美味しい）」はenak/lezatの意味です。' }),
  quiz(613, L(12), 3, { question: '「からい」の意味は？', options: [{ value: 'a', label: 'Pedas' }, { value: 'b', label: 'Manis' }, { value: 'c', label: 'Asin' }, { value: 'd', label: 'Asam' }], correct: 'a', explanation: '「からい（辛い）」はpedasの意味です。' }),
  quiz(614, L(12), 4, { question: '食事が終わったあと、何と言いますか？', options: [{ value: 'a', label: 'ごちそうさまでした' }, { value: 'b', label: 'いただきます' }, { value: 'c', label: 'おいしい' }, { value: 'd', label: 'ありがとうございます' }], correct: 'a', explanation: '「ごちそうさまでした」は食事の後に言います。' }),
  quiz(615, L(12), 5, { question: '「すきです」の意味は？', options: [{ value: 'a', label: 'Saya suka' }, { value: 'b', label: 'Saya tidak suka' }, { value: 'c', label: 'Enak' }, { value: 'd', label: 'Tidak enak' }], correct: 'a', explanation: '「すきです（好きです）」はSaya sukaの意味です。' }),
  quiz(616, L(12), 6, { question: '「なにがすきですか？」の意味は？', options: [{ value: 'a', label: 'Apa yang Anda suka?' }, { value: 'b', label: 'Berapa harganya?' }, { value: 'c', label: 'Di mana?' }, { value: 'd', label: 'Jam berapa?' }], correct: 'a', explanation: '「なにがすきですか」はApa yang Anda suka?の意味です。' }),
];

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.bulkInsert('jp_topics', TOPICS);
  await queryInterface.bulkInsert('jp_lessons', LESSONS);
  await queryInterface.bulkInsert('jp_exercises', EXERCISES);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.bulkDelete('jp_exercises', {});
  await queryInterface.bulkDelete('jp_lessons', {});
  await queryInterface.bulkDelete('jp_topics', {});
}
