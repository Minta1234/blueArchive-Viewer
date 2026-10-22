// Authentic Blue Archive UIWork dialogue, audio clips and Stand interaction data
export const WORK_DATA = {
  arona: {
    characterId: 9009000,
    name: 'Arona',
    standModelId: 'SpineCharacters/arona_spr/arona_spr',
    audioDir: 'audio/Arona',
    actors: {
      Sleep: {
        intro: [
          { audio: 'audio/Arona/arona_work_sleep_in_1.ogg', text: 'むにゃ、イチゴミルクは…うひひ。', textEn: 'Zzz. Strawberry milk... Heeheehee.' },
          { audio: 'audio/Arona/arona_work_sleep_in_2.ogg', text: 'そんなに食べられません……。', textEn: "Eat all that? No, I couldn't..." }
        ],
        exit: [
          { audio: 'audio/Arona/arona_work_sleep_exit_1.ogg', text: 'あっ？', textEn: 'Wh-wha...huh?' },
          { audio: 'audio/Arona/arona_work_sleep_exit_2.ogg', text: 'あっ！', textEn: 'Ah?!' },
          { audio: 'audio/Arona/arona_work_sleep_exit_3.ogg', text: 'あれ？', textEn: '...Huh?' }
        ]
      },
      Watch: {
        intro: [
          { audio: 'audio/Arona/arona_work_watch_in_1.ogg', text: 'うん、よし！今日も良い天気ですね。', textEn: 'Another day means another clear sky.' },
          { audio: 'audio/Arona/arona_work_watch_in_2.ogg', text: 'うーん…雨、降るのかな。', textEn: "Hmm... Maybe it'll rain." }
        ],
        exit: [
          { audio: 'audio/Arona/arona_work_watch_exit_1.ogg', text: 'あっ！', textEn: 'Ah!' },
          { audio: 'audio/Arona/arona_work_watch_exit_2.ogg', text: 'あれ？', textEn: 'Huh?' }
        ]
      },
      Sit: {
        intro: [
          { audio: 'audio/Arona/arona_work_sit_in_1.ogg', text: 'ルンルン～♬', textEn: 'Mm-hmm...♬' }
        ],
        exit: [
          { audio: 'audio/Arona/arona_work_sit_exit_1.ogg', text: 'えっ？', textEn: 'Eh?' },
          { audio: 'audio/Arona/arona_work_sit_exit_2.ogg', text: 'あれ？', textEn: 'Huh?' },
          { audio: 'audio/Arona/arona_work_sit_exit_3.ogg', text: 'あっ！', textEn: 'Ah!' }
        ]
      },
      AronaSleepSit: {
        intro: [
          { audio: 'audio/NP0035/np0035_work_aronasleepsit_in_1_2.ogg', text: 'イチゴミルク…ですか？', textEn: 'Strawberry milk...?' },
          { audio: 'audio/NP0035/np0035_work_aronasleepsit_in_2_2.ogg', text: '先輩、そろそろ起きる時間ですよ。', textEn: 'Senpai, you should get up soon.' }
        ],
        exit: [
          { audio: 'audio/Arona/arona_work_sleep_exit_1.ogg', text: 'あっ？', textEn: 'Wh-wha...huh?' }
        ]
      },
      AronaSleepPeek: {
        intro: [
          { audio: 'audio/NP0035/np0035_work_aronasleeppeek_in_1_2.ogg', text: '寝ているのでしょうか……。', textEn: 'Is she sleeping?' },
          { audio: 'audio/NP0035/np0035_work_aronasleeppeek_in_2_2.ogg', text: 'やはり、寝ていますね……。', textEn: "As I thought, she's sleeping..." }
        ],
        exit: [
          { audio: 'audio/Arona/arona_work_sleep_exit_1.ogg', text: 'あっ？', textEn: 'Wh-wha...huh?' }
        ]
      }
    },
    standGreeting: [
      { audio: 'audio/Arona/arona_work_in_1.ogg', text: '先生！お待ちしておりました！', textEn: "Sensei! I've been waiting for you!", expr: '12' },
      { audio: 'audio/Arona/arona_work_in_2.ogg', text: 'さあ、お仕事を始める時間です！', textEn: "Let's get to work!", expr: '25' },
      { audio: 'audio/Arona/arona_work_in_3.ogg', text: 'どのお仕事から始めますか、先生？', textEn: 'Any task you want to do in particular, sensei?', expr: '31' },
      { audio: 'audio/Arona/arona_work_in_4.ogg', text: '私が先生のお仕事を手伝います！', textEn: 'I can give you a hand with whatever you want!', expr: '32' }
    ],
    standTalk: [
      { audio: 'audio/Arona/arona_work_talk_1.ogg', text: 'ここで先生の、様々なお仕事を始めることができます！', textEn: 'Manage tasks you need to complete from here!', expr: '00' },
      { audio: 'audio/Arona/arona_work_talk_2.ogg', text: '先生！ご希望のお仕事を選んでください。私が隣で手伝います！', textEn: "Sensei! Pick a task. I'll back you up!", expr: '25' },
      { audio: 'audio/Arona/arona_work_talk_3.ogg', text: '解決していただかねばならないお仕事がたくさんです。大人って大変ですね。', textEn: "Here's everything on your docket. Adults have it rough, huh?", expr: '13' },
      { audio: 'audio/Arona/arona_work_talk_4.ogg', text: '解決するべきことがいっぱいですね！頑張りましょう！', textEn: "There's lots of work to do, but I know you can do it!", expr: '12' },
      { audio: 'audio/Arona/arona_work_talk_5.ogg', text: 'たまには身体のことも考えないと、先生の健康が心配です！', textEn: 'Take care of your health too. It gotta take priority!', expr: '18' },
      { audio: 'audio/Arona/arona_work_talk_6.ogg', text: 'うわぁ…。ものすごい量の仕事ですね。', textEn: 'Oh...that a lot of work.', expr: '29' },
      { audio: 'audio/Arona/arona_work_talk_7_1.ogg', text: 'さあ、頑張りましょう！先生！', textEn: 'You got this, Sensei!', expr: '25' }
    ]
  },
  plana: {
    characterId: 9009005,
    name: 'Plana',
    standModelId: 'SpineCharacters/NP0035_spr/NP0035_spr',
    audioDir: 'audio/NP0035',
    actors: {
      PlanaCabinet: {
        intro: [
          { audio: 'audio/NP0035/np0035_work_cabinet_in_1.ogg', text: 'ここは……そういうことなのですね。', textEn: "So, that's what this is..." },
          { audio: 'audio/NP0035/np0035_work_cabinet_in_2.ogg', text: '……そういうことですね。', textEn: '...So that is how it is.' }
        ],
        exit: [
          { audio: 'audio/NP0035/np0035_work_cabinet_exit_1.ogg', text: '……あ。', textEn: '...Ah.' }
        ]
      },
      PlanaSit: {
        intro: [
          { audio: 'audio/NP0035/np0035_work_sit_in_1.ogg', text: 'うーん……。', textEn: 'Mmm...' }
        ],
        exit: [
          { audio: 'audio/NP0035/np0035_work_sit_exit_1.ogg', text: 'あ。', textEn: 'Ah.' }
        ]
      },
      PlanaUmbrella: {
        intro: [
          { audio: 'audio/NP0035/np0035_work_umbrella_in_1.ogg', text: '雨が降ったらこれで……', textEn: 'If it rains...' }
        ],
        exit: [
          { audio: 'audio/NP0035/np0035_work_umbrella_exit_1.ogg', text: 'あ。', textEn: 'Ah.' }
        ]
      },
      PlanaWatchSky: {
        intro: [
          { audio: 'audio/Arona/arona_work_planawatchsky_in_1_1.ogg', text: 'あれ、見えますか？プラナちゃん？', textEn: 'Can you see that, Plana-chan?' }
        ],
        exit: [
          { audio: 'audio/NP0035/np0035_work_planawatchsky_exit_1.ogg', text: '……あ。', textEn: '...Ah.' }
        ]
      },
      PlanaSitPeek: {
        intro: [
          { audio: 'audio/Arona/arona_work_planasitpeek_in_1_1.ogg', text: 'じーっ', textEn: 'Stare~' },
          { audio: 'audio/NP0035/np0035_work_planasitpeek_in_1_2.ogg', text: 'うーん……。', textEn: 'Hmm...' }
        ],
        exit: [
          { audio: 'audio/NP0035/np0035_work_planasitpeek_exit_1.ogg', text: 'あ。', textEn: 'Ah.' }
        ]
      },
      PlanaPot: {
        intro: [
          { audio: 'audio/NP0035/np0035_work_sit_in_1.ogg', text: 'うーん……。', textEn: 'Mmm...' }
        ],
        exit: [
          { audio: 'audio/NP0035/np0035_work_sit_exit_1.ogg', text: 'あ。', textEn: 'Ah.' }
        ]
      }
    },
    standGreeting: [
      { audio: 'audio/NP0035/np0035_work_in_1_1.ogg', text: '接続確認。先生。お待ちしておりました。', textEn: "Connecting. Sensei, I've been waiting for you.", expr: '02' },
      { audio: 'audio/NP0035/np0035_work_in_2.ogg', text: 'お仕事を始める時間です。先生。', textEn: "It's time to get to work.", expr: '03' },
      { audio: 'audio/NP0035/np0035_work_in_3.ogg', text: 'どのお仕事から始めますか。先生？', textEn: 'Which task would you like to start with, Sensei?', expr: '00' },
      { audio: 'audio/NP0035/np0035_work_in_4.ogg', text: '待機中。解決しなければならない作業が多数存在しています。', textEn: 'On standby. There are numerous tasks that need to be resolved.', expr: '02' }
    ],
    standTalk: [
      { audio: 'audio/NP0035/np0035_work_talk_1.ogg', text: 'ここで先生の様々なお仕事を進行できます。', textEn: 'You can carry out your various tasks here, Sensei.', expr: '03' },
      { audio: 'audio/NP0035/np0035_work_talk_2.ogg', text: '先生。ご希望のお仕事を選んでください。', textEn: 'Sensei. Please select whatever task you wish to do.', expr: '03' },
      { audio: 'audio/NP0035/np0035_work_talk_3.ogg', text: '解決していただかねばならないお仕事がたくさんあります。では、お願いします。', textEn: 'There are many tasks that need to be resolved. Now then, if you please.', expr: '03' },
      { audio: 'audio/NP0035/np0035_work_talk_4.ogg', text: '混乱。理解できない行動です。つつかないでください。故障します。', textEn: 'Perplexing. This is a meaningless action. Please do not poke me. Doing so will result in damage.', expr: '13' },
      { audio: 'audio/NP0035/np0035_work_talk_5.ogg', text: '理解しました。先生は今特にやるべきことがないのですね。暇なのですね。', textEn: "Understood. Sensei doesn't have anything in particular to do at the moment, so you're free.", expr: '12' }
    ]
  }
};

export function getWorkDataForModel(modelId) {
  const isNight = /night/i.test(modelId);
  return isNight ? WORK_DATA.plana : WORK_DATA.arona;
}
