import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const JP_TO_EN = {
  'セイア': 'Seia',
  'サツキ': 'Satsuki',
  'セナ': 'Sena',
  'ニヤ': 'Niya',
  'キサキ': 'Kisaki',
  'リオ': 'Rio',
  'ラブ': 'Love',
  'ニコ': 'Niko',
  'クルミ': 'Kurumi',
  'オトギ': 'Otogi',
  'イズミ': 'Izumi',
  'ナツ': 'Natsu',
  'ナグサ': 'Nagusa',
  'ヤクモ': 'Yakumo',
  'タカネ': 'Takane',
  'マキ': 'Maki',
  'チアキ': 'Chiaki',
  'ヒカリ': 'Hikari',
  'ノゾミ': 'Nozomi',
  'レイ': 'Rei',
  'ムツキ': 'Mutsuki',
  'ハルカ': 'Haruka',
  'フィーナ': 'Pina',
  'サオリ': 'Saori',
  'コノカ': 'Konoka',
  'ミサキ': 'Misaki',
  'マリナ': 'Marina',
  'トモエ': 'Tomoe',
  'マリー': 'Mari',
  'サクラコ': 'Sakurako',
  'ミネ': 'Mine',
  'ネル': 'Neru',
  'アスナ': 'Asuna',
  'カリン': 'Karin',
  'ユウカ': 'Yuuka',
  'ノア': 'Noa',
  'ジュリ': 'Juri',
  'スミレ': 'Sumire',
  'アオバ': 'Aoba',
  'ハスミ': 'Hasumi',
  'イチカ': 'Ichika',
  'ナギサ': 'Nagisa',
  'ミカ': 'Mika',
  'ミチル': 'Michiru',
  'ツクヨ': 'Tsukuyo',
  'キキョウ': 'Kikyou',
  'ユカリ': 'Yukari',
  'レンゲ': 'Renge',
  'エリ': 'Eri',
  'レナ': 'Rena',
  'カノエ': 'Kanoe',
  'アカネ': 'Akane',
  'スバル': 'Subaru',
  'コユキ': 'Koyuki',
  'ミヨ': 'Miyo',
  'フユ': 'Fuyu',
  'リツ': 'Ritsu',
  'アンナ': 'Anna',
  'エリナ': 'Erina',
  'スズミ': 'Suzumi',
  'レイサ': 'Reisa',
  'カスミ': 'Kasumi',
  'ヒマリ': 'Himari',
  'トキ': 'Toki',
  'アリス': 'Aris',
  'ケイ': 'Key',
  'ユズ': 'Yuzu',
  'エイミ': 'Eimi',
  'マコト': 'Makoto',
  'イロハ': 'Iroha',
  'イブキ': 'Ibuki',
  'シュン': 'Shun',
  'ココロ': 'Kokoro',
  'コトネ': 'Kotone',
  'エリカ': 'Erika',
  'レイジョ': 'Reijo'
};

// Known costume or variant names for specific CH lobby folders
const CH_SPECIAL = {
  'CH0060BG_home': 'Tsurugi (Swimsuit) [BG]',
  'CH0184_00': 'Yuuka (Track) [Layer 2]',
  'CH0280_home': 'Neru (Agent)',
  'CH0281_home': 'Asuna (Agent)',
  'CH0282_home': 'Karin (Agent)',
  'CH0284_home': 'Yuuka (Pajama)',
  'CH0285_home': 'Noa (Pajama)',
  'CH0294_home': 'Mika (Swimsuit)',
  'CH0335_home': 'Key',
  'CH0344_home': 'Makoto (Pirate)',
  'CH0345_home': 'Satsuki (Pirate)',
  'CH0346_home': 'Iroha (Pirate)',
  'CH0347_home': 'Ibuki (Pirate)'
};

async function main() {
  const enRes = await fetch('https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/data/en/students.json');
  const enData = await enRes.json();
  const idToEn = new Map(enData.map(s => [s.Id, s.Name]));
  const devToEn = new Map();
  for (const s of enData) {
    if (s.DevName) devToEn.set(s.DevName.toLowerCase(), s.Name);
    if (s.PathName) devToEn.set(s.PathName.toLowerCase(), s.Name);
  }

  const profilesPath = path.join(root, 'data/local-char-profiles.json');
  const profiles = fs.existsSync(profilesPath) ? JSON.parse(fs.readFileSync(profilesPath, 'utf8')) : {};
  const dialogues = JSON.parse(fs.readFileSync(path.join(root, 'data/dialogues.json'), 'utf8'));
  const models = JSON.parse(fs.readFileSync(path.join(root, 'data/models.json'), 'utf8'));

  function formatStandardName(str) {
    // E.g. 'Aru_newyear_home' -> 'Aru (New Year)'
    // 'Azusa_swimsuit_home' -> 'Azusa (Swimsuit)'
    // 'Airi0_home' -> 'Airi'
    let s = str.replace(/_home.*$/i, '').replace(/_Scene$/i, ' (Scene)').replace(/_bg$/i, ' (BG)');
    s = s.replace(/0$/, ''); // Airi0 -> Airi
    s = s.replace(/_newyear/i, ' (New Year)');
    s = s.replace(/_swimsuit/i, ' (Swimsuit)');
    s = s.replace(/_riding/i, ' (Cycling)');
    s = s.replace(/_casual/i, ' (Casual)');
    s = s.replace(/_maid/i, ' (Maid)');
    s = s.replace(/_bunny/i, ' (Bunny)');
    s = s.replace(/_cheerleader|_cheer/i, ' (Cheer Squad)');
    s = s.replace(/_track/i, ' (Track)');
    s = s.replace(/_hotspring/i, ' (Hot Spring)');
    s = s.replace(/_christmas/i, ' (Christmas)');
    s = s.replace(/_dress/i, ' (Dress)');
    s = s.replace(/_band/i, ' (Band)');
    s = s.replace(/_camp/i, ' (Camp)');
    s = s.replace(/_small/i, ' (Small)');
    s = s.replace(/_original/i, '');
    s = s.replace(/_/g, ' ');
    // capitalize words
    return s.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ').trim();
  }

  for (const m of models) {
    const diag = dialogues.byModel[m.id];
    const cid = diag?.characterId;
    let name = null;

    if (CH_SPECIAL[m.folder]) {
      name = CH_SPECIAL[m.folder];
    } else if (cid && idToEn.has(cid)) {
      name = idToEn.get(cid);
    } else {
      const code = m.folder.replace(/_home.*$/i, '').replace(/_spr.*$/i, '').toLowerCase();
      if (devToEn.has(code)) {
        name = devToEn.get(code);
        if (m.category === 'SpineCharacters') name += ' (Sprite)';
      }
    }

    if (!name && cid && profiles[cid]) {
      const p = profiles[cid];
      const jp = p.jp_given || p.jp_full;
      name = JP_TO_EN[jp] || jp;
    }

    if (!name) {
      if (/^CH\d+/i.test(m.folder)) {
        const code = m.folder.replace(/_home.*$/i, '').replace(/_spr.*$/i, '').toUpperCase();
        name = code;
      } else {
        name = formatStandardName(m.folder);
      }
    }

    // Special background names
    if (m.category === 'SpineBackground') {
      if (m.folder.startsWith('Ui_RaidBoss_')) {
        name = 'Raid Boss: ' + m.folder.replace('Ui_RaidBoss_', '');
      } else if (m.folder.startsWith('SC')) {
        name = 'Scene: ' + m.folder;
      } else if (m.folder === 'Arona_workpage') {
        name = 'Arona (Workpage)';
      } else if (m.folder.startsWith('Arona_workpage_')) {
        name = 'Arona (' + m.folder.replace('Arona_workpage_', '').replace(/_/g, ' ') + ')';
      } else if (m.folder === 'Sora_shop') {
        name = 'Sora (Shop)';
      } else if (m.folder === 'Rin_raiddungeon') {
        name = 'Rin (Raid Lobby)';
      } else if (m.folder === 'Momoka_weekdungeon') {
        name = 'Momoka (Bounty Lobby)';
      }
    }

    m.displayName = name;
  }

  fs.writeFileSync(path.join(root, 'data/models.json'), JSON.stringify(models));
  console.log(`Updated models.json with display names for ${models.length} models.`);

  const sample = models.filter(m => m.category === 'SpineLobbies' && /^CH0(099|100|101|107|109|110|113|114|123|058)/.test(m.folder));
  console.log('Sample user models:');
  for (const s of sample) {
    console.log(`  ${s.folder.padEnd(20)} => ${s.displayName}`);
  }
}

main().catch(console.error);
