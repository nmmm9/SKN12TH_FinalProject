const { App, ExpressReceiver } = require('@slack/bolt');

// 환경 변수 디버깅
console.log('🔍 Slack 환경 변수 확인:');
console.log('BOT_TOKEN:', process.env.SLACK_BOT_TOKEN ? '✅ 존재' : '❌ 없음');
console.log('SIGNING_SECRET:', process.env.SLACK_SIGNING_SECRET ? '✅ 존재' : '❌ 없음');

// 환경 변수 검증
if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_SIGNING_SECRET) {
  console.warn('⚠️ Slack 환경 변수가 설정되지 않았습니다. Slack 기능이 비활성화됩니다.');
  console.log('BOT_TOKEN 값:', process.env.SLACK_BOT_TOKEN?.substring(0, 10) + '...');
  console.log('SIGNING_SECRET 값:', process.env.SLACK_SIGNING_SECRET?.substring(0, 10) + '...');
  module.exports = { slackApp: null };
  return;
}

console.log('🚀 Slack 앱 초기화 시작...');

let app;
try {
  // Express Receiver 명시적 생성
  const receiver = new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    endpoints: '/events'  // 기본 엔드포인트 명시
  });

  app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    receiver: receiver
  });
  
  console.log('✅ Slack 앱 객체 생성 성공');
  console.log('✅ Receiver 객체:', app.receiver ? '존재' : '없음');
  console.log('✅ Router 객체:', app.receiver?.router ? '존재' : '없음');
  console.log('✅ Express 인스턴스:', app.receiver?.app ? '존재' : '없음');
  
  // 디버깅: receiver의 실제 구조 확인
  console.log('🔍 Receiver 속성들:', Object.keys(app.receiver));
  
} catch (error) {
  console.error('❌ Slack 앱 초기화 실패:', error);
  module.exports = { slackApp: null };
  return;
}

// 모든 이벤트 디버깅
app.event(/.*/, async ({ event, ack }) => {
  console.log('🔍 수신된 이벤트:', event.type, event);
  await ack();
});

// 모든 명령어 디버깅  
app.command(/.*/, async ({ command, ack, respond }) => {
  console.log('🔍 수신된 명령어:', command.command, command);
  await ack();
  
  if (command.command === '/tk') {
    const text = command.text.trim();
    console.log(`📱 Slack 명령어 수신: /tk ${text}`);
    
    // 기존 /tk 처리 로직
    await handleTkCommand(text, respond);
  } else {
    await respond({
      text: `알 수 없는 명령어: ${command.command}. \`/tk help\`를 사용해보세요.`
    });
  }
});

// /tk 명령어 처리 함수
async function handleTkCommand(text, respond) {
  
  if (!text || text === 'help') {
    await respond({
      text: '🚀 TtalKkak 사용법',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🎯 TtalKkak AI 프로젝트 관리*\n\n*사용 가능한 명령어:*\n• `/tk start` - 새 프로젝트 시작\n• `/tk team` - 팀원 정보 설정\n• `/tk status` - 프로젝트 현황\n• `/tk help` - 도움말'
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🎤 *시작하려면:* 회의 음성 파일을 업로드하거나 `/tk start`를 입력하세요!'
          }
        }
      ]
    });
  } else if (text === 'start') {
    await respond({
      text: '🎯 새 프로젝트 시작',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🚀 새 프로젝트를 시작합니다!*\n\n다음 중 하나를 선택하세요:'
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🎤 음성 업로드'
              },
              value: 'upload_voice',
              action_id: 'upload_voice_button'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '✍️ 텍스트 입력'
              },
              value: 'input_text',
              action_id: 'input_text_button'
            }
          ]
        }
      ]
    });
  } else if (text === 'team') {
    await respond({
      text: '👥 팀원 정보 설정',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*👥 팀원 정보 설정*\n\n스마트 업무 배정을 위해 팀원들의 기술 정보를 수집합니다.'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🔧 *준비 중인 기능:*\n• 개인별 기술 스택 수집\n• 경험 레벨 설정\n• 선호 업무 유형 설정'
          }
        }
      ]
    });
  } else if (text === 'status') {
    await respond({
      text: '📊 프로젝트 현황',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*📊 프로젝트 현황 확인*\n\n현재 진행 중인 프로젝트와 업무 상태를 확인합니다.'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🔧 *준비 중인 기능:*\n• 진행 중인 프로젝트 목록\n• 팀원별 업무 현황\n• 완료율 및 통계'
          }
        }
      ]
    });
  } else {
    await respond({
      text: '❓ 알 수 없는 명령어',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `❓ *"${text}"*는 알 수 없는 명령어입니다.\n\n\`/tk help\`를 입력해서 사용법을 확인해보세요!`
          }
        }
      ]
    });
  }
}

// 버튼 클릭 이벤트 처리
app.action('upload_voice_button', async ({ ack, respond }) => {
  await ack();
  await respond({
    text: '🎤 음성 파일을 이 채널에 드래그하거나 업로드해주세요!\n\n지원 형식: MP3, WAV, M4A'
  });
});

app.action('input_text_button', async ({ ack, respond }) => {
  await ack();
  await respond({
    text: '✍️ 회의 내용을 텍스트로 입력해주세요:\n\n예시: "새로운 전자상거래 앱을 개발해야 합니다. 사용자 인증, 상품 관리, 결제 시스템이 필요합니다."'
  });
});

// 메시지 이벤트 처리
app.message(async ({ message, ack, say }) => {
  // 즉시 응답 (3초 내 필수)
  await ack();
  
  console.log('💬 메시지 수신:', message);
  
  // 봇 메시지나 자기 자신의 메시지는 무시
  if (message.subtype === 'bot_message' || !message.text) {
    return;
  }
  
  // TtalKkak 관련 키워드가 포함된 메시지만 처리
  const keywords = ['ttalkka', '따깍', '프로젝트', '회의', '기획'];
  const hasKeyword = keywords.some(keyword => 
    message.text.toLowerCase().includes(keyword.toLowerCase())
  );
  
  if (hasKeyword) {
    await say({
      text: '👋 안녕하세요! TtalKkak입니다.',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🚀 *TtalKkak AI 프로젝트 관리*\n\n`/tk` 명령어를 사용해서 시작해보세요!\n\n• `/tk start` - 새 프로젝트 시작\n• `/tk help` - 도움말'
          }
        }
      ]
    });
  }
});

// 파일 업로드 이벤트 처리
app.event('file_shared', async ({ event, ack, say }) => {
  // 즉시 응답 (3초 내 필수)
  await ack();
  
  console.log('📁 파일 업로드 감지:', event);
  
  if (event.file && event.file.mimetype && event.file.mimetype.includes('audio')) {
    await say({
      text: '🎵 음성 파일을 받았습니다!',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🎵 *음성 파일 수신 완료*\n\n파일명: ${event.file.name}\n크기: ${Math.round(event.file.size / 1024)}KB\n\n🔄 AI 분석을 시작합니다...`
          }
        }
      ]
    });
    
    // TODO: 실제 음성 처리 로직 연결
    setTimeout(async () => {
      await say('✅ 음성 분석 완료! 프로젝트가 생성되었습니다. (데모 응답)');
    }, 3000);
  }
});

// 에러 핸들링
app.error((error) => {
  console.error('❌ Slack 앱 에러:', error);
});

console.log('🤖 Slack 핸들러 초기화 완료');

module.exports = { slackApp: app };