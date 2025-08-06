const { App, ExpressReceiver } = require('@slack/bolt');

// AI 서비스 초기화
let aiService;
try {
  const { AIService } = require('./services/ai-service');
  aiService = new AIService();
  console.log('✅ AI 서비스 초기화 완료');
} catch (error) {
  console.error('❌ AI 서비스 초기화 실패:', error);
}

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

// 메시지 이벤트 처리 (파일 업로드 포함)
app.event('message', async ({ event, message, say, client }) => {
  // 봇 메시지나 변경된 메시지는 무시
  if (event.subtype === 'message_changed' || event.subtype === 'bot_message') {
    return;
  }
  
  console.log('🔍 수신된 메시지 이벤트:', event.type, event);
  
  // 파일이 포함된 메시지 처리
  if (event.files && event.files.length > 0) {
    console.log('📁 메시지에 파일 첨부 감지:', event.files);
    
    for (const file of event.files) {
      console.log('📄 파일 정보:', file);
      
      // 오디오/비디오 파일 확인
      if (file.mimetype && (
        file.mimetype.includes('audio') || 
        file.mimetype.includes('video') ||
        file.name.toLowerCase().includes('.mp3') ||
        file.name.toLowerCase().includes('.wav') ||
        file.name.toLowerCase().includes('.m4a') ||
        file.name.toLowerCase().includes('.mp4')
      )) {
        
        // 대기 중인 프로젝트명 가져오기
        global.pendingProjects = global.pendingProjects || {};
        const projectName = global.pendingProjects[event.user] || '새 프로젝트';
        
        await say({
          text: '🎵 음성 파일을 받았습니다!',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `🎯 *프로젝트:* ${projectName}\n🎵 *파일:* ${file.name}\n📊 *크기:* ${Math.round(file.size / 1024)}KB\n\n🧠 AI가 음성을 분석하고 있습니다...`
              }
            }
          ]
        });
        
        try {
          // 실제 AI 처리
          if (aiService) {
            const result = await aiService.processAudioFile({
              fileUrl: file.url_private_download,
              fileName: file.name,
              projectName: projectName,
              userId: event.user
            });
            
            await say({
              text: '✅ 프로젝트 생성이 완료되었습니다!',
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `🎯 *${projectName}*\n\n✅ AI 분석이 완료되어 업무가 자동 생성되었습니다!`
                  }
                },
                {
                  type: 'actions',
                  elements: [
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '📋 Notion 페이지 보기'
                      },
                      url: result.notionUrl || '#',
                      action_id: 'view_notion'
                    },
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '🎫 JIRA 이슈 보기'
                      },
                      url: result.jiraUrl || '#',
                      action_id: 'view_jira'
                    }
                  ]
                }
              ]
            });
            
            // 처리 완료 후 임시 데이터 정리
            delete global.pendingProjects[event.user];
            
          } else {
            // AI 서비스가 없는 경우 데모 응답
            setTimeout(async () => {
              await say({
                text: '✅ 데모: 음성 분석 완료!',
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: `🎯 *${projectName}*\n\n✅ 데모 모드로 프로젝트가 생성되었습니다.`
                    }
                  }
                ]
              });
              delete global.pendingProjects[event.user];
            }, 3000);
          }
          
        } catch (error) {
          console.error('❌ 파일 처리 오류:', error);
          await say({
            text: `❌ 파일 처리 중 오류가 발생했습니다: ${error.message}`
          });
        }
        
        break; // 첫 번째 음성 파일만 처리
      }
    }
  }
});

// 모든 명령어 디버깅  
app.command(/.*/, async ({ command, ack, respond, client }) => {
  console.log('🔍 수신된 명령어:', command.command, command);
  
  try {
    await ack();
    
    if (command.command === '/tk') {
      const text = command.text.trim();
      console.log(`📱 Slack 명령어 수신: /tk ${text}`);
      
      // 채널 정보를 포함해서 처리
      await handleTkCommandSafe(text, respond, client, command.channel_id, command.user_id);
    } else {
      await respond({
        text: `알 수 없는 명령어: ${command.command}. \`/tk help\`를 사용해보세요.`
      });
    }
  } catch (error) {
    console.error('❌ Slash command 처리 오류:', error);
    try {
      await respond({
        text: `❌ 명령어 처리 중 오류가 발생했습니다: ${error.message}`
      });
    } catch (respondError) {
      console.error('❌ 응답 전송 실패:', respondError);
    }
  }
});

// /tk 명령어 안전 처리 래퍼
async function handleTkCommandSafe(text, respond, client, channelId, userId) {
  try {
    console.log(`🎯 처리 시작: /tk ${text}`);
    await handleTkCommand(text, respond, client, channelId, userId);
    console.log(`✅ 처리 완료: /tk ${text}`);
  } catch (error) {
    console.error(`❌ /tk ${text} 명령어 처리 오류:`, error);
    console.error('오류 상세:', {
      message: error.message,
      stack: error.stack,
      channelId,
      userId,
      text
    });
    
    try {
      await respond({
        text: `❌ 명령어 처리 중 오류가 발생했습니다.\n\n**오류 내용:** ${error.message}\n\n다시 시도해주세요.`
      });
    } catch (respondError) {
      console.error('❌ 오류 응답 전송 실패:', respondError);
    }
  }
}

// /tk 명령어 처리 함수
async function handleTkCommand(text, respond, client, channelId, userId) {
  
  if (text === 'process') {
    // 파일 처리 강제 실행
    await respond({
      text: '🎵 가장 최근 업로드된 음성 파일을 처리합니다...',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🧠 AI가 음성을 분석하고 있습니다... (데모 모드)\n\n✅ 3초 후 결과가 표시됩니다.'
          }
        }
      ]
    });
    
    // 데모 처리
    setTimeout(async () => {
      const projectName = global.pendingProjects?.[process.env.USER_ID] || '새 프로젝트';
      await respond({
        text: '✅ 데모: 음성 분석 완료!',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🎯 *${projectName}*\n\n✅ 데모 모드로 프로젝트가 생성되었습니다.`
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '📋 Notion 페이지 보기'
                },
                url: '#',
                action_id: 'view_notion_demo'
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '🎫 JIRA 이슈 보기'
                },
                url: '#',
                action_id: 'view_jira_demo'
              }
            ]
          }
        ]
      });
    }, 3000);
    return;
  }
  
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
                value: JSON.stringify({ action: 'upload_voice', channelId: channelId }),
                action_id: 'upload_voice_button'
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '📝 회의록 등록'
                },
                value: 'input_transcript',
                action_id: 'input_transcript_button'
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '🐛 디버깅'
                },
                value: 'debugging_mode',
                action_id: 'debugging_button'  // ⭐ 새로 추가
              }
            ]
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🔗 외부 서비스 연동 (선택사항)*\n\n연동하면 자동으로 회의록과 업무가 생성됩니다:'
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📝 Notion 연동'
              },
              value: 'connect_notion',
              action_id: 'connect_notion_button'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🎫 JIRA 연동'
              },
              value: 'connect_jira',
              action_id: 'connect_jira_button'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '⚙️ 연동 상태 확인'
              },
              value: 'check_integrations',
              action_id: 'check_integrations_button'
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
app.action('upload_voice_button', async ({ ack, client, body }) => {
  await ack();
  
  try {
    // 버튼 값에서 채널 ID 추출 시도
    let channelId;
    try {
      const buttonValue = JSON.parse(body.actions[0].value);
      channelId = buttonValue.channelId;
    } catch (e) {
      // JSON 파싱 실패 시 기존 방식으로 fallback
      channelId = body.channel?.id || body.message?.channel || body.container?.channel_id;
    }
    
    console.log('🔍 버튼 클릭 이벤트 채널 정보:', {
      'body.channel?.id': body.channel?.id,
      'body.message?.channel': body.message?.channel,
      'body.container?.channel_id': body.container?.channel_id,
      'button value channelId': channelId,
      'selected channelId': channelId
    });
    
    // 파일 업로드 모달 표시
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'voice_upload_modal',
        private_metadata: channelId, // 채널 ID 저장
        title: {
          type: 'plain_text',
          text: '🎤 음성 파일 업로드'
        },
        submit: {
          type: 'plain_text',
          text: '확인'
        },
        close: {
          type: 'plain_text',
          text: '취소'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*음성 파일을 업로드해주세요*\n\n지원 형식: MP3, WAV, M4A (최대 100MB)'
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*파일 업로드 방법:*\n1. 이 모달을 닫고 채널에 음성 파일을 드래그앤드롭\n2. 또는 채널에서 클립 📎 버튼으로 파일 업로드\n\n*지원 형식:* MP3, WAV, M4A, MP4'
            }
          },
          {
            type: 'input',
            block_id: 'project_name_input',
            element: {
              type: 'plain_text_input',
              action_id: 'project_name',
              placeholder: {
                type: 'plain_text',
                text: '예: 모바일 앱 리뉴얼 프로젝트'
              }
            },
            label: {
              type: 'plain_text',
              text: '프로젝트 이름 (선택사항)'
            },
            optional: true
          }
        ]
      }
    });
    
    console.log('✅ 음성 업로드 모달 표시 완료');
  } catch (error) {
    console.error('❌ 모달 표시 실패:', error);
  }
});

// Notion 연동 버튼
app.action('connect_notion_button', async ({ ack, body, respond }) => {
  await ack();
  
  const userId = body.user.id;
  const tenantSlug = 'dev-tenant'; // 임시로 고정, 나중에 동적으로 설정
  
  // OAuth URL 생성
  const state = Buffer.from(JSON.stringify({
    tenantId: tenantSlug,
    userId,
    timestamp: Date.now()
  })).toString('base64');
  
  const authUrl = `${process.env.APP_URL || 'http://localhost:3500'}/auth/notion/${tenantSlug}?userId=${encodeURIComponent(userId)}&state=${encodeURIComponent(state)}`;
  
  console.log('🔍 생성된 완전한 URL:', authUrl);
  
  await respond({
    text: '📝 Notion 연동',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*📝 Notion과 연동하시겠습니까?*\n\n연동하면 회의록이 자동으로 Notion 페이지에 생성됩니다.'
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🔗 Notion 연결하기'
            },
            value: JSON.stringify({ authUrl, userId, tenantSlug }),
            action_id: 'notion_oauth_redirect'
          }
        ]
      }
    ]
  });
});

// Notion OAuth 리다이렉트 처리
app.action('notion_oauth_redirect', async ({ ack, body, respond }) => {
  await ack();
  
  try {
    const actionData = JSON.parse(body.actions[0].value);
    const { authUrl } = actionData;
    
    await respond({
      text: '🔗 Notion 연동',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*📝 Notion 연동을 위해 아래 링크를 클릭하세요*\n\n새 창에서 Notion 인증을 진행합니다.'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `<${authUrl}|🔗 Notion 인증 페이지로 이동>`
          }
        }
      ]
    });
  } catch (error) {
    console.error('Notion OAuth 리다이렉트 오류:', error);
    await respond({
      text: '❌ 연동 처리 중 오류가 발생했습니다.'
    });
  }
});

// JIRA 연동 버튼
app.action('connect_jira_button', async ({ ack, body, respond }) => {
  await ack();
  
  try {
    // JIRA 설정 확인
    const jiraClientId = process.env.JIRA_CLIENT_ID;
    
    if (!jiraClientId || jiraClientId === 'YOUR-JIRA-CLIENT-ID-HERE') {
      // JIRA 설정이 완료되지 않은 경우
      await respond({
        text: '🎫 JIRA 연동',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*🎫 JIRA 연동 준비 중*\n\n현재 JIRA 연동 설정을 구성하고 있습니다.\n잠시 후 다시 시도해주세요.'
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '💡 _관리자가 JIRA 클라이언트 ID를 설정하면 연동이 가능합니다._'
              }
            ]
          }
        ]
      });
      return;
    }
    
    const userId = body.user.id;
    const tenantSlug = 'dev-tenant'; // 임시로 고정, 나중에 동적으로 설정
    
    // OAuth URL 생성
    const state = Buffer.from(JSON.stringify({
      tenantId: tenantSlug,
      userId,
      timestamp: Date.now()
    })).toString('base64');
    
    const authUrl = `${process.env.APP_URL || 'http://localhost:3500'}/auth/jira/${tenantSlug}?userId=${userId}&state=${state}`;
    
    await respond({
      text: '🎫 JIRA 연동',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🎫 JIRA와 연동하시겠습니까?*\n\n연동하면 생성된 업무가 자동으로 JIRA 이슈로 생성됩니다.'
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🔗 JIRA 연결하기'
              },
              value: JSON.stringify({ authUrl, userId, tenantSlug }),
              action_id: 'jira_oauth_redirect'
            }
          ]
        }
      ]
    });
  } catch (error) {
    console.error('JIRA 연동 버튼 처리 오류:', error);
    await respond({
      text: '❌ JIRA 연동 처리 중 오류가 발생했습니다.'
    });
  }
});

// JIRA OAuth 리다이렉트 처리
app.action('jira_oauth_redirect', async ({ ack, body, respond }) => {
  await ack();
  
  try {
    const actionData = JSON.parse(body.actions[0].value);
    const { authUrl } = actionData;
    
    await respond({
      text: '🔗 JIRA 연동',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🎫 JIRA 연동을 위해 아래 링크를 클릭하세요*\n\n새 창에서 Atlassian 인증을 진행합니다.'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `<${authUrl}|🔗 JIRA 인증 페이지로 이동>`
          }
        }
      ]
    });
  } catch (error) {
    console.error('JIRA OAuth 리다이렉트 오류:', error);
    await respond({
      text: '❌ 연동 처리 중 오류가 발생했습니다.'
    });
  }
});

// 연동 상태 확인 버튼
app.action('check_integrations_button', async ({ ack, body, respond }) => {
  await ack();
  
  try {
    const slackUserId = body.user.id;
    const tenantSlug = 'dev-tenant'; // 슬럭
    
    // Services import
    const { NotionService } = require('./services/notion-service');
    const { JiraService } = require('./services/jira-service');
    const { PrismaClient } = require('@prisma/client');
    
    const prisma = new PrismaClient();
    const jiraService = new JiraService(prisma);
    
    // 먼저 tenant slug를 실제 tenant ID로 변환
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug }
    });
    
    if (!tenant) {
      throw new Error('Tenant not found');
    }
    
    // Slack 사용자 ID를 실제 User ID로 변환
    const user = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        slackUserId: slackUserId
      }
    });
    
    console.log('🔍 연동 상태 확인:', {
      slackUserId,
      tenantSlug,
      tenantId: tenant.id,
      userId: user?.id || 'not found'
    });
    
    // 사용자의 연동 상태 확인 (실제 UUID 사용)
    const [notionStatus, jiraStatus] = await Promise.all([
      user ? NotionService.checkUserIntegration(tenant.id, user.id) : { connected: false },
      user ? jiraService.checkJiraConnection(tenant.id, user.id) : { connected: false }
    ]);
    
    console.log('🔍 연동 상태 확인 결과:', {
      notionStatus,
      jiraStatus
    });
    
    const notionText = notionStatus.connected 
      ? `✅ 연결됨\n워크스페이스: ${notionStatus.workspace_name || 'Unknown'}`
      : '❌ 연결 안됨';
      
    const jiraText = jiraStatus.connected 
      ? `✅ 연결됨\n사이트: ${jiraStatus.site_name || 'Unknown'}`
      : '❌ 연결 안됨';
    
    const integrationCount = (notionStatus.connected ? 1 : 0) + (jiraStatus.connected ? 1 : 0);
    const statusMessage = integrationCount > 0 
      ? `✨ ${integrationCount}개 서비스가 연동되어 있습니다!`
      : '💡 연동하면 회의록과 업무가 자동으로 생성됩니다.';
    
    await respond({
      text: '⚙️ 연동 상태',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🔗 외부 서비스 연동 상태*'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*📝 Notion*\n${notionText}`
            },
            {
              type: 'mrkdwn',
              text: `*🎫 JIRA*\n${jiraText}`
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: statusMessage
            }
          ]
        }
      ]
    });
  } catch (error) {
    console.error('연동 상태 확인 오류:', error);
    await respond({
      text: '❌ 연동 상태 확인 중 오류가 발생했습니다.'
    });
  }
});

app.action('input_transcript_button', async ({ ack, body, client }) => {
  await ack();
  
  try {
    // 슬랙 모달 팝업 열기
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'transcript_input_modal',
        title: {
          type: 'plain_text',
          text: '회의록 등록'
        },
        submit: {
          type: 'plain_text',
          text: '업무 생성'
        },
        close: {
          type: 'plain_text',
          text: '취소'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '📝 *회의록을 입력해주세요*\n\n이미 정리된 회의록을 입력하시면 AI가 바로 PRD와 업무를 생성합니다.\n*요약 과정은 생략됩니다.*'
            }
          },
          {
            type: 'input',
            block_id: 'transcript_input',
            element: {
              type: 'plain_text_input',
              action_id: 'transcript_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: '예시: 오늘 회의에서 논의된 내용을 정리하면...\n\n1. 프로젝트 목표: 새로운 전자상거래 플랫폼 개발\n2. 주요 기능: 사용자 인증, 상품 관리, 결제 시스템\n3. 일정: 3개월 내 완료\n4. 담당자: 프론트엔드 김○○, 백엔드 박○○...'
              },
              min_length: 50
            },
            label: {
              type: 'plain_text',
              text: '회의록 내용 (최소 50자)'
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('모달 열기 오류:', error);
  }
});

// 디버깅 버튼 처리
app.action('debugging_button', async ({ ack, body, client }) => {
  await ack();
  
  try {
    // 기존 회의록 등록과 완전히 동일한 모달 사용
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'transcript_input_modal',  // ⭐ 기존과 동일한 callback_id
        title: {
          type: 'plain_text',
          text: '🐛 디버깅 - 회의록 등록'  // 제목만 살짝 변경
        },
        submit: {
          type: 'plain_text',
          text: '업무 생성'
        },
        close: {
          type: 'plain_text',
          text: '취소'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🐛 *디버깅 모드 - 회의록 등록*\n\n이미 정리된 회의록을 입력하시면 AI가 바로 PRD와 업무를 생성합니다.\n*요약 과정은 생략됩니다.*'
            }
          },
          {
            type: 'input',
            block_id: 'transcript_input',  // ⭐ 기존과 동일
            element: {
              type: 'plain_text_input',
              action_id: 'transcript_text',  // ⭐ 기존과 동일
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: '예시: 오늘 회의에서 논의된 내용을 정리하면...\n\n1. 프로젝트 목표: 새로운 전자상거래 플랫폼 개발\n2. 주요 기능: 사용자 인증, 상품 관리, 결제 시스템\n3. 일정: 3개월 내 완료\n4. 담당자: 프론트엔드 김○○, 백엔드 박○○...'
              },
              min_length: 50
            },
            label: {
              type: 'plain_text',
              text: '회의록 내용 (최소 50자)'
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('디버깅 모달 열기 오류:', error);
  }
});


// 메시지 이벤트 처리
app.message(async ({ message, ack, say }) => {
  // message_changed 이벤트나 봇 메시지는 무시
  if (message.subtype === 'message_changed' || message.subtype === 'bot_message' || !message.text) {
    return;
  }
  
  // 즉시 응답 (3초 내 필수)
  if (ack && typeof ack === 'function') {
    await ack();
  }
  
  console.log('💬 메시지 수신:', message);
  
  // 프로젝트 관련 키워드가 포함된 긴 메시지는 AI 처리
  const projectKeywords = ['프로젝트', '개발', '앱', '시스템', '기능', '서비스', '플랫폼'];
  const hasProjectKeyword = projectKeywords.some(keyword => 
    message.text.includes(keyword)
  );
  
  // 메시지가 50자 이상이고 프로젝트 키워드가 포함된 경우 AI 처리
  if (message.text.length >= 50 && hasProjectKeyword) {
    await processTextWithAI(message.text, say);
    return;
  }
  
  // 일반적인 TtalKkak 키워드 응답
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
app.event('file_shared', async ({ event, ack, say, client }) => {
  // 즉시 응답 (3초 내 필수)
  await ack();
  
  console.log('📁 파일 업로드 감지:', event);
  
  if (event.file && event.file.mimetype && (
    event.file.mimetype.includes('audio') || 
    event.file.mimetype.includes('video') ||
    event.file.name.toLowerCase().includes('.mp3') ||
    event.file.name.toLowerCase().includes('.wav') ||
    event.file.name.toLowerCase().includes('.m4a') ||
    event.file.name.toLowerCase().includes('.mp4')
  )) {
    
    // 대기 중인 프로젝트명 가져오기
    global.pendingProjects = global.pendingProjects || {};
    const projectName = global.pendingProjects[event.user_id] || '새 프로젝트';
    
    await say({
      text: '🎵 음성 파일을 받았습니다!',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🎯 *프로젝트:* ${projectName}\n🎵 *파일:* ${event.file.name}\n📊 *크기:* ${Math.round(event.file.size / 1024)}KB\n\n🧠 AI가 음성을 분석하고 있습니다...`
          }
        }
      ]
    });
    
    try {
      // 실제 AI 처리
      if (aiService) {
        const fileInfo = await client.files.info({
          file: event.file.id
        });
        
        const result = await aiService.processAudioFile({
          fileUrl: fileInfo.file.url_private_download,
          fileName: event.file.name,
          projectName: projectName,
          userId: event.user_id
        });
        
        await say({
          text: '✅ 프로젝트 생성이 완료되었습니다!',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `🎯 *${projectName}*\n\n✅ AI 분석이 완료되어 업무가 자동 생성되었습니다!`
              }
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '📋 Notion 페이지 보기'
                  },
                  url: result.notionUrl || '#',
                  action_id: 'view_notion'
                },
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '🎫 JIRA 이슈 보기'
                  },
                  url: result.jiraUrl || '#',
                  action_id: 'view_jira'
                }
              ]
            }
          ]
        });
        
        // 처리 완료 후 임시 데이터 정리
        delete global.pendingProjects[event.user_id];
        
      } else {
        // AI 서비스가 없는 경우 데모 응답
        setTimeout(async () => {
          await say({
            text: '✅ 데모: 음성 분석 완료!',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `🎯 *${projectName}*\n\n✅ 데모 모드로 프로젝트가 생성되었습니다.`
                }
              }
            ]
          });
          delete global.pendingProjects[event.user_id];
        }, 3000);
      }
      
    } catch (error) {
      console.error('❌ 파일 처리 오류:', error);
      await say({
        text: `❌ 파일 처리 중 오류가 발생했습니다: ${error.message}`
      });
    }
  }
});

// AI 텍스트 처리 함수
// 회의록 전용 처리 함수 (완전 새 버전)
async function processTranscriptWithAI(transcript, client, channelId) {
  const slackUserId = channelId; // DM에서는 channelId가 userId와 같음
  const tenantSlug = 'dev-tenant'; // 임시로 고정
  
  try {
    console.log('📝 회의록 직접 처리 시작:', transcript.substring(0, 100) + '...');
    
    // ⭐ AI 서비스 호출 부분 주석처리
    /*
    if (!aiService) {
      throw new Error('AI 서비스가 초기화되지 않았습니다.');
    }
    // 회의록 → PRD → 업무 생성 (요약 과정 생략)
    const result = await aiService.processTwoStagePipeline(
      Buffer.from(transcript), 
      'transcript-input.txt'
    );
    
    console.log('🔍 2단계 파이프라인 결과:', JSON.stringify(result, null, 2));
    */
    
    // ⭐ JSON 입력 데이터 직접 파싱
    console.log('📋 입력 JSON 데이터 직접 파싱');
    let inputData;
    try {
      inputData = JSON.parse(transcript);
      console.log('✅ JSON 파싱 성공:', {
        hasSummary: !!inputData.summary,
        hasActionItems: !!inputData.action_items,
        actionItemsCount: inputData.action_items?.length || 0
      });
    } catch (parseError) {
      console.error('❌ JSON 파싱 실패:', parseError);
      throw new Error('유효하지 않은 JSON 형식입니다.');
    }

    // ⭐ 입력 데이터에서 직접 추출 (복잡한 로직 제거)
    const extractedSummary = inputData.summary || '프로젝트 개요가 생성되었습니다.';
    const extractedTitle = inputData.summary?.substring(0, 50) || '생성된 프로젝트';
    const actionItems = inputData.action_items || [];
    
    // InputData 인터페이스에 맞게 구성
    const aiData = {
      summary: extractedSummary,
      action_items: actionItems
    };
    
    console.log('📊 추출된 AI 데이터:', {
      summary: aiData.summary.substring(0, 50) + '...',
      tasksCount: aiData.action_items.length
    });
    
    const projectTitle = extractedTitle;
    const projectSummary = aiData.summary;
    const tasksCount = aiData.action_items.length;
    
    // Notion 연동 시도
    let notionPageUrl = null;
    try {
      const { NotionService } = require('./services/notion-service');
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      // tenant slug를 실제 tenant ID로 변환
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug }
      });
      
      if (!tenant) {
        throw new Error('Tenant not found');
      }
      
      // Slack 사용자 ID를 실제 User ID로 변환
      const user = await prisma.user.findFirst({
        where: {
          tenantId: tenant.id,
          slackUserId: slackUserId
        }
      });
      
      if (!user) {
        console.log(`❌ Notion 연동 없음: tenantId=${tenantSlug}, userId=${slackUserId}`);
        throw new Error('User not found');
      }
      
      console.log('🔍 Notion 연동 확인:', {
        tenantId: tenant.id,
        userId: user.id,
        slackUserId: slackUserId
      });
      
      const notionService = await NotionService.createForUser(tenant.id, user.id);
      
      if (notionService) {
        console.log('📝 Notion 페이지 생성 시도...');
        
        // ⭐ InputData 인터페이스에 맞게 데이터 구성
        const notionInputData = {
          summary: aiData.summary,
          action_items: aiData.action_items
        };
        
        // Notion 페이지 생성 직전에 정확히 어떤 데이터가 전달되는지 확인
        console.log('📋 Notion에 전달할 데이터 최종 검증:', {
          summary: notionInputData.summary.substring(0, 50) + '...',
          actionItemsCount: notionInputData.action_items.length,
          firstItem: notionInputData.action_items[0] ? {
            id: notionInputData.action_items[0].id,
            title: notionInputData.action_items[0].title,
            start_date: notionInputData.action_items[0].start_date,
            deadline: notionInputData.action_items[0].deadline,
            start_date_type: typeof notionInputData.action_items[0].start_date
          } : 'NONE'
        });
        
        const notionPage = await notionService.createMeetingPage(notionInputData);
        
        notionPageUrl = notionPage.url;
        console.log('✅ Notion 페이지 생성 성공:', notionPageUrl);
      } else {
        console.log('ℹ️ Notion 연동 안됨');
      }
    } catch (notionError) {
      console.error('❌ Notion 페이지 생성 실패:', notionError);
      // Notion 실패해도 계속 진행
    }
    
    // JIRA 연동 시도
    let jiraResult = null;
    try {
      const { JiraService } = require('./services/jira-service');
      const { PrismaClient } = require('@prisma/client');
      
      const prisma = new PrismaClient();
      const jiraService = new JiraService(prisma);
      
      // tenant slug를 실제 tenant ID로 변환
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug }
      });
      
      if (!tenant) {
        throw new Error('Tenant not found for JIRA');
      }
      
      // Slack 사용자 ID를 실제 User ID로 변환
      const user = await prisma.user.findFirst({
        where: {
          tenantId: tenant.id,
          slackUserId: slackUserId
        }
      });
      
      if (!user) {
        console.log(`❌ JIRA 연동 없음: tenantId=${tenantSlug}, userId=${slackUserId}`);
        throw new Error('User not found for JIRA');
      }
      
      // JIRA 연동 상태 확인
      const jiraStatus = await jiraService.checkJiraConnection(tenant.id, user.id);
      
      // 실제 AI 태스크 데이터 사용
      const tasks = aiData.action_items;
      
      if (jiraStatus.connected && tasks && tasks.length > 0) {
        console.log('🎫 JIRA 계층적 이슈 생성 시도...');
        
        let projectKey = 'TK'; // fallback
        try {
          const jiraService = new JiraService(prisma);
          const integration = await jiraService.getJiraIntegration(tenant.id, user.id);
          projectKey = integration?.config?.defaultProjectKey || 'TK284743';
        } catch (error) {
          console.log('프로젝트 키 조회 실패, 기본값 사용');
        }

        const jiraResult = await jiraService.syncTaskMasterToJira(tenant.id, user.id, {
          title: projectTitle,
          overview: projectSummary,
          tasks: tasks,
          projectKey: projectKey  // ← 프로젝트 키 직접 전달
        });
        
        if (jiraResult.success) {
          console.log(`✅ TaskMaster → JIRA 매핑 완료: Epic ${jiraResult.epicsCreated}개, Task ${jiraResult.tasksCreated}개`);
        } else {
          console.error('❌ TaskMaster → JIRA 매핑 실패:', jiraResult.error);
        }
      } else {
        console.log('ℹ️ JIRA 연동 조건 미충족:', {
          connected: jiraStatus.connected,
          jiraError: jiraStatus.error,
          tasksCount: tasks.length
        });
      }
    } catch (jiraError) {
      console.error('❌ JIRA 이슈 생성 실패:', jiraError.message);
      // JIRA 실패해도 계속 진행
    }
    
    // ⭐ 버튼 생성 (무조건 두 개 다 표시)
    const actionElements = [];
    
    // 1. Notion 버튼 (성공/실패 관계없이 항상 표시)
    const notionUrl = notionPageUrl || `${process.env.APP_URL}/auth/notion/${tenantSlug}?userId=${slackUserId}`;
    const notionButtonText = notionPageUrl ? '📝 Notion에서 보기' : '🔗 Notion 연결하기';
    
    // ⭐ 여기에 디버깅 로그 추가
    console.log('🔍 Notion 버튼 생성 디버깅:', {
      notionPageUrl: notionPageUrl,
      notionPageUrlExists: !!notionPageUrl,
      buttonText: notionButtonText
    });
    
    actionElements.push({
      type: 'button',
      text: {
        type: 'plain_text',
        text: notionButtonText
      },
      url: notionUrl,
      action_id: notionPageUrl ? 'view_notion_page' : 'connect_notion'
    });
    
    // 2. JIRA 버튼 (성공/실패 관계없이 항상 표시)
    let jiraUrl = '#';
    let jiraButtonText = '🎫 JIRA에서 보기';
    
    try {
      const { JiraService } = require('./services/jira-service');
      const { PrismaClient } = require('@prisma/client');
      
      const prisma = new PrismaClient();
      const jiraService = new JiraService(prisma);
      
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug }
      });
      
      if (tenant) {
        const user = await prisma.user.findFirst({
          where: {
            tenantId: tenant.id,
            slackUserId: slackUserId
          }
        });
        
        if (user) {
          const integration = await jiraService.getJiraIntegration(tenant.id, user.id);
          
          if (integration?.config?.site_url) {
            // JIRA 연동 성공한 경우
            if (jiraResult?.success && jiraResult.epics && jiraResult.epics.length > 0) {
              if (jiraResult.epics.length === 1) {
                jiraUrl = `${integration.config.site_url}/browse/${jiraResult.epics[0]}`;
                jiraButtonText = '🎫 Epic 보기';
              } else {
                const projectKey = jiraResult.projectKey || integration?.config?.defaultProjectKey || 'TK';
                jiraUrl = `${integration.config.site_url}/jira/software/projects/${projectKey}/timeline`;
                jiraButtonText = '🎫 JIRA 타임라인 보기';
              }
            } else {
              const projectKey = jiraResult?.projectKey || integration?.config?.defaultProjectKey || 'TK';
              jiraUrl = `${integration.config.site_url}/jira/software/projects/${projectKey}/timeline`;
              jiraButtonText = '🎫 JIRA 타임라인 보기';
            }
          } else {
            // JIRA 연동이 안된 경우
            jiraUrl = `${process.env.APP_URL}/auth/jira/${tenantSlug}?userId=${slackUserId}`;
            jiraButtonText = '🔗 JIRA 연결하기';
          }
        } else {
          jiraUrl = `${process.env.APP_URL}/auth/jira/${tenantSlug}?userId=${slackUserId}`;
          jiraButtonText = '🔗 JIRA 연결하기';
        }
      } else {
        jiraUrl = `${process.env.APP_URL}/auth/jira/${tenantSlug}?userId=${slackUserId}`;
        jiraButtonText = '🔗 JIRA 연결하기';
      }
    } catch (error) {
      console.error('JIRA 버튼 생성 실패:', error);
      jiraUrl = `${process.env.APP_URL}/auth/jira/${tenantSlug}?userId=${slackUserId}`;
      jiraButtonText = '🔗 JIRA 연결하기';
    }
    
    actionElements.push({
      type: 'button',
      text: {
        type: 'plain_text',
        text: jiraButtonText
      },
      url: jiraUrl,
      action_id: jiraUrl.includes('atlassian') ? 'view_jira_project' : 'connect_jira'
    });
    
    // ⭐ 결과 메시지 전송 (버튼 포함)
    const resultBlocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🎯 *${projectTitle}*\n\n📋 **개요:**\n${projectSummary.substring(0, 200)}${projectSummary.length > 200 ? '...' : ''}\n\n📊 **생성된 업무:** ${tasksCount}개`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*✨ 처리 완료된 항목:*\n• ✅ 회의록 분석\n• ✅ PRD 생성\n• ✅ 업무 생성\n• ✅ 담당자 배정${notionPageUrl ? '\n• ✅ Notion 페이지 생성' : ''}${jiraResult?.success ? `\n• ✅ JIRA Epic ${jiraResult.epicsCreated}개, Task ${jiraResult.tasksCreated}개 생성` : ''}`
        }
      }
    ];
    
    // ⭐ 핵심: actions 블록 추가
    if (actionElements.length > 0) {
      resultBlocks.push({
        type: 'actions',
        elements: actionElements
      });
    }
    
    await client.chat.postMessage({
      channel: channelId,
      text: '✅ 회의록 분석 완료!',
      blocks: resultBlocks
    });
    
    // 생성된 업무 목록 전송 (실제 데이터로)
    if (aiData.action_items && aiData.action_items.length > 0) {
      const taskList = aiData.action_items.slice(0, 5).map((task, index) => 
        `${index + 1}. ${task.title} (복잡도: ${task.complexity || 'medium'}, ${task.estimated_hours || 0}h${task.assignee ? `, 담당: ${task.assignee}` : ''})`
      ).join('\n');
      
      await client.chat.postMessage({
        channel: channelId,
        text: '📋 생성된 업무 목록',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*📋 생성된 업무 목록 (상위 ${Math.min(5, aiData.action_items.length)}개)*\n\n${taskList}${aiData.action_items.length > 5 ? `\n\n... 외 ${aiData.action_items.length - 5}개 업무` : ''}`
            }
          }
        ]
      });
    }
    
  } catch (error) {
    console.error('❌ 회의록 처리 오류:', error);
    await client.chat.postMessage({
      channel: channelId,
      text: '❌ 회의록 분석 중 오류가 발생했습니다.',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⚠️ *처리 오류*\n\n${error.message}\n\n🔄 다시 시도하거나 \`/tk help\`를 입력해서 도움말을 확인해보세요.`
          }
        }
      ]
    });
  }
}

// 모달에서 입력받은 텍스트 AI 처리 함수
async function processTextWithAIFromModal(text, client, channelId) {
  try {
    console.log('🧠 모달 AI 텍스트 처리 시작:', text.substring(0, 100) + '...');

    if (!aiService) {
      throw new Error('AI 서비스가 초기화되지 않았습니다.');
    }

    // AI 서비스로 노션 프로젝트 생성
    const result = await aiService.generateNotionProject(text);
    
    // 디버깅용 로그
    console.log('🔍 AI 응답 구조:', JSON.stringify(result, null, 2));
    
    if (result.success && result.notion_project) {
      // 안전한 데이터 추출
      const title = result.notion_project.title || '생성된 프로젝트';
      const overview = result.notion_project.overview || '프로젝트 개요가 생성되었습니다.';
      const objectives = Array.isArray(result.notion_project.objectives) ? result.notion_project.objectives : ['목표가 생성되었습니다.'];
      
      // 텍스트 길이 제한
      const shortOverview = overview.length > 200 ? overview.substring(0, 200) + '...' : overview;
      const limitedObjectives = objectives.slice(0, 3).map(obj => `• ${obj}`).join('\n');
      
      await client.chat.postMessage({
        channel: channelId,
        text: '✅ AI 분석 완료!',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🎯 *${title}*\n\n📋 **프로젝트 개요:**\n${shortOverview}\n\n🔗 **핵심 목표:**\n${limitedObjectives}`
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '⚡ 업무 생성'
                },
                value: 'generate_tasks',
                action_id: 'generate_tasks_button'
              }
            ]
          }
        ]
      });
      
      // 전역 변수에 결과 저장 (실제로는 데이터베이스에 저장해야 함)
      global.lastNotionProject = result.notion_project;
      
    } else {
      throw new Error(result.error || 'AI 분석에 실패했습니다.');
    }
    
  } catch (error) {
    console.error('❌ 모달 AI 텍스트 처리 오류:', error);
    await client.chat.postMessage({
      channel: channelId,
      text: '❌ AI 분석 중 오류가 발생했습니다.',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⚠️ *오류 발생*\n\n${error.message}\n\n🔄 다시 시도하거나 \`/tk help\`를 입력해서 도움말을 확인해보세요.`
          }
        }
      ]
    });
  }
}

// 버튼 액션 핸들러 추가

app.action('generate_tasks_button', async ({ ack, respond }) => {
  await ack();
  
  if (!global.lastNotionProject) {
    await respond({
      text: '❌ 저장된 프로젝트 정보가 없습니다. 다시 프로젝트 분석을 진행해주세요.'
    });
    return;
  }

  try {
    // 진행 상황 즉시 알림
    await respond({
      text: '⚡ 업무 생성 중입니다...',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*⚡ 업무 생성 진행 중*\n\n📝 PRD 생성 → ⚡ 업무 분석 → 📋 결과 정리'
          }
        }
      ]
    });

    console.log('🚀 전체 업무 생성 프로세스 시작...');
    
    // 1단계: PRD 생성 (내부적으로 진행)
    console.log('📝 1단계: PRD 생성 중...');
    const prdResult = await aiService.generateTaskMasterPRD(global.lastNotionProject);
    
    if (!prdResult.success) {
      throw new Error(prdResult.error || 'PRD 생성에 실패했습니다.');
    }

    // 2단계: 업무 생성
    console.log('⚡ 2단계: 업무 생성 중...');
    const tasksResult = await aiService.generateTasks(prdResult.prd);
    
    if (!tasksResult.success) {
      throw new Error(tasksResult.error || '업무 생성에 실패했습니다.');
    }

    // 성공 결과 응답
    const tasks = tasksResult.tasks;
    const taskBlocks = tasks.slice(0, 5).map((task, index) => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${index + 1}. ${task.title}*\n🔹 ${task.description.substring(0, 100)}...\n⚡ 복잡도: ${task.complexity}/10 | 우선순위: ${task.priority}`
      }
    }));

    await respond({
      text: `✅ 업무 생성 완료! 총 ${tasks.length}개 업무가 생성되었습니다.`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*✅ 업무 생성 완료!*\n\n📊 생성된 업무: **${tasks.length}개**\n🎯 프로젝트: **${global.lastNotionProject.project_name}**`
          }
        },
        {
          type: 'divider'
        },
        ...taskBlocks,
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: tasks.length > 5 ? `\n*... 외 ${tasks.length - 5}개 업무*\n\n🔗 전체 업무는 JIRA나 웹 대시보드에서 확인하세요!` : '\n🔗 JIRA나 웹 대시보드에서 상세 정보를 확인하세요!'
          }
        }
      ]
    });

    console.log(`✅ 업무 생성 완료: ${tasks.length}개 업무 생성됨`);

  } catch (error) {
    console.error('❌ 업무 생성 오류:', error);
    await respond({
      text: '❌ 업무 생성 중 오류가 발생했습니다.',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⚠️ *업무 생성 실패*\n\n오류: ${error.message}\n\n🔄 다시 시도하거나 프로젝트 분석을 다시 진행해주세요.`
          }
        }
      ]
    });
  }
});

// 모달 제출 처리
app.view('transcript_input_modal', async ({ ack, body, view, client }) => {
  await ack();
  
  try {
    // 입력된 회의록 추출
    const transcriptText = view.state.values.transcript_input.transcript_text.value;
    const userId = body.user.id;
    const channelId = body.user.id; // DM으로 결과 전송
    
    console.log('📝 모달에서 회의록 입력 받음:', transcriptText.substring(0, 100) + '...');
    
    // 즉시 분석 시작 메시지 전송
    await client.chat.postMessage({
      channel: channelId,
      text: '🔄 AI가 회의록을 분석하여 PRD와 업무를 생성 중입니다...',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🧠 *회의록 → PRD → 업무 생성*\n\n입력하신 회의록을 바탕으로 PRD와 구체적인 업무를 생성하고 있습니다.\n*요약 과정은 생략됩니다.*\n\n⏱️ 예상 소요 시간: 1-2분'
          }
        }
      ]
    });
    
    // AI 처리 함수 호출
    await processTranscriptWithAI(transcriptText, client, channelId);
    
  } catch (error) {
    console.error('❌ 모달 처리 오류:', error);
  }
});


// 에러 핸들링
app.error((error) => {
  console.error('❌ Slack 앱 에러:', error);
});

console.log('🤖 Slack 핸들러 초기화 완료');

// 음성 업로드 모달 제출 처리
app.view('voice_upload_modal', async ({ ack, body, view, client }) => {
  await ack();
  
  try {
    const userId = body.user.id;
    const channelId = body.user.id; // DM으로 처리
    
    // 모달에서 입력된 값들 추출
    const values = view.state.values;
    const projectName = values.project_name_input?.project_name?.value || '새 프로젝트';
    
    console.log('📁 모달 제출 데이터:', {
      projectName,
      userId
    });
    
    // 명령어를 입력한 채널에 메시지 전송
    const commandChannel = body.view.private_metadata; // 채널 ID를 모달에서 가져옴
    
    await client.chat.postMessage({
      channel: commandChannel || userId,
      text: `🎯 "${projectName}" 프로젝트가 준비되었습니다!`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🎯 *프로젝트:* ${projectName}\n\n📁 *30초 내에 음성 파일을 업로드해주세요:*\n• 이 채널에 파일을 드래그앤드롭\n• 또는 📎 클립 버튼으로 업로드\n\n지원 형식: MP3, WAV, M4A, MP4\n⏰ *제한시간: 30초*`
          }
        }
      ]
    });
    
    // 프로젝트 정보를 임시 저장
    global.pendingProjects = global.pendingProjects || {};
    global.pendingProjects[userId] = {
      projectName: projectName,
      timestamp: Date.now(),
      channelId: commandChannel || userId
    };
    
    // 30초 후 자동으로 최근 파일 검색 및 처리
    setTimeout(async () => {
      await checkRecentFiles(client, userId, projectName);
    }, 30000);
    
  } catch (error) {
    console.error('❌ 음성 업로드 모달 처리 오류:', error);
    await client.chat.postMessage({
      channel: body.user.id,
      text: `❌ 파일 처리 중 오류가 발생했습니다: ${error.message}`
    });
  }
});

// 업로드된 파일 처리 함수
async function processUploadedFile(file, projectName, client, userId) {
  try {
    console.log('🔄 파일 처리 시작:', file.name);
    
    // Slack 파일 다운로드를 위한 URL 가져오기
    const fileInfo = await client.files.info({
      file: file.id
    });
    
    console.log('📁 파일 상세 정보:', fileInfo.file);
    
    if (!fileInfo.file.url_private_download) {
      throw new Error('파일 다운로드 URL을 가져올 수 없습니다.');
    }
    
    // 상태 업데이트
    await client.chat.postMessage({
      channel: userId,
      text: '🧠 AI가 음성을 분석하고 있습니다...'
    });
    
    // AI 서비스로 처리 (실제 구현 필요)
    if (aiService) {
      const result = await aiService.processAudioFile({
        fileUrl: fileInfo.file.url_private_download,
        fileName: file.name,
        projectName: projectName,
        userId: userId
      });
      
      // 결과 전송
      await client.chat.postMessage({
        channel: userId,
        text: '✅ 프로젝트 생성이 완료되었습니다!',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🎯 *${projectName}*\n\n✅ 업무가 성공적으로 생성되었습니다.`
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '📋 Notion 페이지 보기'
                },
                url: result.notionUrl || '#',
                action_id: 'view_notion'
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '🎫 JIRA 이슈 보기'
                },
                url: result.jiraUrl || '#',
                action_id: 'view_jira'
              }
            ]
          }
        ]
      });
    } else {
      throw new Error('AI 서비스가 초기화되지 않았습니다.');
    }
    
  } catch (error) {
    console.error('❌ 파일 처리 오류:', error);
    await client.chat.postMessage({
      channel: userId,
      text: `❌ 파일 처리 중 오류가 발생했습니다: ${error.message}`
    });
  }
}

// 최근 파일 확인 및 처리 함수
async function checkRecentFiles(client, userId, projectName) {
  try {
    console.log(`🔍 ${userId}의 최근 파일 검색 시작...`);
    
    // 사용자 정보 확인
    const projectInfo = global.pendingProjects?.[userId];
    if (!projectInfo) {
      console.log('❌ 프로젝트 정보가 없습니다.');
      return;
    }
    
    const startTime = projectInfo.timestamp;
    const endTime = Date.now();
    const channelId = projectInfo.channelId || userId; // 저장된 채널 ID 사용
    
    // Slack Files API로 최근 파일 검색
    const filesResponse = await client.files.list({
      user: userId,
      ts_from: Math.floor(startTime / 1000), // Unix timestamp (초)
      ts_to: Math.floor(endTime / 1000),
      types: 'all',
      count: 10
    });
    
    console.log('📁 검색된 파일들:', filesResponse.files?.length || 0);
    
    if (!filesResponse.files || filesResponse.files.length === 0) {
      await client.chat.postMessage({
        channel: channelId,
        text: '⏰ 30초 내에 업로드된 음성 파일이 없습니다.',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '⏰ *시간 초과*\n\n30초 내에 음성 파일이 업로드되지 않았습니다.\n\n🔄 다시 시도하려면 `/tk start`를 입력해주세요.'
            }
          }
        ]
      });
      
      // 임시 데이터 정리
      delete global.pendingProjects[userId];
      return;
    }
    
    // 음성/비디오 파일 찾기
    const audioFiles = filesResponse.files.filter(file => {
      return file.mimetype && (
        file.mimetype.includes('audio') ||
        file.mimetype.includes('video') ||
        file.name.toLowerCase().includes('.mp3') ||
        file.name.toLowerCase().includes('.wav') ||
        file.name.toLowerCase().includes('.m4a') ||
        file.name.toLowerCase().includes('.mp4')
      );
    });
    
    if (audioFiles.length === 0) {
      await client.chat.postMessage({
        channel: channelId,
        text: '❌ 음성 파일이 발견되지 않았습니다.',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '❌ *음성 파일 없음*\n\n30초 내에 업로드된 파일 중 음성 파일이 없습니다.\n\n지원 형식: MP3, WAV, M4A, MP4\n\n🔄 다시 시도하려면 `/tk start`를 입력해주세요.'
            }
          }
        ]
      });
      
      delete global.pendingProjects[userId];
      return;
    }
    
    // 가장 최근 음성 파일 처리
    const latestFile = audioFiles[0];
    console.log('🎵 처리할 파일:', latestFile.name);
    
    await client.chat.postMessage({
      channel: channelId,
      text: '🎵 음성 파일을 발견했습니다!',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🎯 *프로젝트:* ${projectName}\n🎵 *파일:* ${latestFile.name}\n📊 *크기:* ${Math.round(latestFile.size / 1024)}KB\n\n🧠 AI가 음성을 분석하고 있습니다...`
          }
        }
      ]
    });
    
// AI 처리 부분 수정
    try {
      if (aiService) {
        const result = await aiService.processAudioFile({
          fileUrl: latestFile.url_private_download,
          fileName: latestFile.name,
          projectName: projectName,
          userId: userId
        });
        
        // 버튼 요소 준비
        const actionElements = [];
        let notionUrl = '#';
        let notionButtonText = '🔗 Notion 연결하기';
        
        console.log('🔍 AI 결과 구조 확인:', {
          hasResult: !!result,
          hasMeetingData: !!result?.meetingData,
          resultKeys: result ? Object.keys(result) : [],
          meetingDataKeys: result?.meetingData ? Object.keys(result.meetingData) : []
        });
        
        // Notion 연동 상태 확인 및 자동 페이지 생성 (수정된 부분)
        try {
          const { NotionService } = require('./services/notion-service');
          const { PrismaClient } = require('@prisma/client');
          
          const prisma = new PrismaClient();
          
          // tenant와 user 정보 조회
          const tenantSlug = 'dev-tenant';
          const tenant = await prisma.tenant.findUnique({
            where: { slug: tenantSlug }
          });
          
          console.log('🏢 Tenant 정보:', { found: !!tenant, id: tenant?.id });
          
          if (tenant) {
            let user = await prisma.user.findFirst({
              where: {
                tenantId: tenant.id,
                slackUserId: userId
              }
            });
            
            // 사용자가 없으면 생성
            if (!user) {
              console.log('👤 새 사용자 생성:', userId);
              user = await prisma.user.create({
                data: {
                  tenantId: tenant.id,
                  slackUserId: userId,
                  email: `${userId}@slack.local`,
                  name: `Slack User ${userId}`,
                  role: 'MEMBER'
                }
              });
            }
            
        console.log('👤 사용자 정보:', { found: !!user, id: user?.id });
        
        // Notion 연동 상태 확인
        const notionStatus = await NotionService.checkUserIntegration(tenant.id, user.id);
        console.log('🔗 Notion 연동 상태:', notionStatus);
        
        if (notionStatus.connected) {
          console.log('✅ Notion 연동 확인됨, 페이지 생성 시작...');
          
          // Notion 연동이 되어 있으면 자동으로 페이지 생성
          const notionService = await NotionService.createForUser(tenant.id, user.id);
          
          if (notionService) {
            // ⭐ 여기가 핵심! AI 결과를 올바르게 변환
            console.log('🔄 AI 결과 데이터 변환 시작...');
            console.log('🔍 원본 result 구조:', {
              hasResult: !!result,
              resultKeys: result ? Object.keys(result) : [],
              hasMeetingData: !!result?.meetingData,
              meetingDataKeys: result?.meetingData ? Object.keys(result.meetingData) : []
            });
            
            // AI 결과에서 올바른 데이터 추출
            let aiData = null;
            
            // 1. result.meetingData가 있는 경우
            if (result?.meetingData) {
              aiData = result.meetingData;
            }
            // 2. result 자체에 데이터가 있는 경우
            else if (result) {
              aiData = result;
            }
            
            console.log('📊 추출된 AI 데이터:', {
              hasAiData: !!aiData,
              aiDataKeys: aiData ? Object.keys(aiData) : [],
              hasActionItems: !!(aiData?.action_items),
              actionItemsCount: aiData?.action_items ? aiData.action_items.length : 0,
              hasSummary: !!(aiData?.summary),
              hasTitle: !!(aiData?.title)
            });
            
            // Notion용 meetingData 구성 (실제 AI 데이터 사용)
            const meetingData = {
              // 제목: AI에서 추출하거나 프로젝트명 사용
              title: aiData?.title || projectName,
              
              // 개요: AI summary를 우선적으로 사용
              overview: aiData?.summary || aiData?.overview || `${projectName} 프로젝트입니다.`,
              
              // 목표: AI에서 추출
              objectives: aiData?.objectives || aiData?.goals || [`${projectName}의 성공적인 완료`],
              
              // 날짜
              date: new Date().toLocaleDateString('ko-KR'),
              
              // 참석자
              attendees: aiData?.attendees || [`Slack User ${userId}`],
              
              // ⭐ 핵심: action_items를 tasks로 전달
              tasks: aiData?.action_items || aiData?.tasks || [],
              
              // 추가 정보들도 전달 (NotionService에서 활용할 수 있도록)
              summary: aiData?.summary,
              action_items: aiData?.action_items
            };
            
            console.log('📋 Notion 전달 데이터:', {
              title: meetingData.title,
              overview: meetingData.overview.substring(0, 100) + '...',
              objectivesCount: meetingData.objectives.length,
              tasksCount: meetingData.tasks.length,
              hasActionItems: !!(meetingData.action_items),
              actionItemsCount: meetingData.action_items ? meetingData.action_items.length : 0
            });
            
            // Notion 페이지 생성
            const notionPage = await notionService.createMeetingPage(aiData);
            
            notionUrl = notionPage.url;
            notionButtonText = '📋 Notion에서 보기';
            
            console.log('✅ Notion 페이지 생성 완료:', notionUrl);
          } else {
            console.log('❌ NotionService 생성 실패');
            notionUrl = `${process.env.APP_URL}/auth/notion/${tenantSlug}?userId=${userId}`;
            notionButtonText = '🔗 Notion 다시 연결하기';
          }
        } else {
          console.log('❌ Notion 연동 안됨:', notionStatus);
          // Notion 연동이 안되어 있으면 연동 버튼 표시
          notionUrl = `${process.env.APP_URL}/auth/notion/${tenantSlug}?userId=${userId}`;
          notionButtonText = '🔗 Notion 연결하기';
        }
      } else {
        console.log('❌ Tenant 찾을 수 없음');
        notionUrl = `${process.env.APP_URL}/auth/notion/dev-tenant?userId=${userId}`;
        notionButtonText = '🔗 Notion 연결하기';
      }
    } catch (notionError) {
      console.error('❌ Notion 처리 오류:', notionError);
      // 오류 발생 시에도 연동 버튼은 표시
      const tenantSlug = 'dev-tenant';
      notionUrl = `${process.env.APP_URL}/auth/notion/${tenantSlug}?userId=${userId}`;
      notionButtonText = '🔗 Notion 연결하기 (오류 복구)';
    }
        
        // JIRA 버튼 추가 (기존 코드 유지)
        let jiraUrl = '#';
        let jiraButtonText = '🎫 JIRA에서 보기';
        
        try {
          const { JiraService } = require('./services/jira-service');
          const { PrismaClient } = require('@prisma/client');
          
          const prisma = new PrismaClient();
          const jiraService = new JiraService(prisma);
          
          // tenant와 user 정보 조회
          const tenantSlug = 'dev-tenant';
          const tenant = await prisma.tenant.findUnique({
            where: { slug: tenantSlug }
          });
          
          if (tenant) {
            const user = await prisma.user.findFirst({
              where: {
                tenantId: tenant.id,
                slackUserId: userId
              }
            });
            
            if (user) {
              const integration = await jiraService.getJiraIntegration(tenant.id, user.id);
              
              if (integration?.config?.site_url) {
                // JIRA 연동이 되어 있으면 실제 프로젝트로 이동
                if (result.jiraUrl && result.jiraUrl !== '#') {
                  jiraUrl = result.jiraUrl;
                  jiraButtonText = '🎫 JIRA 이슈 보기';
                } else {
                  const projectKey = integration?.config?.defaultProjectKey || 'TASK';
                  jiraUrl = `${integration.config.site_url}/jira/software/projects/${projectKey}/boards`;
                }
              } else {
                // JIRA 연동이 안되어 있으면 연동 버튼
                jiraUrl = `${process.env.APP_URL}/auth/jira/${tenantSlug}?userId=${userId}`;
                jiraButtonText = '🔗 JIRA 연결하기';
              }
            } else {
              jiraUrl = `${process.env.APP_URL}/auth/jira/${tenantSlug}?userId=${userId}`;
              jiraButtonText = '🔗 JIRA 연결하기';
            }
          } else {
            jiraUrl = `${process.env.APP_URL}/auth/jira/${tenantSlug}?userId=${userId}`;
            jiraButtonText = '🔗 JIRA 연결하기';
          }
        } catch (error) {
          console.error('JIRA 버튼 생성 실패:', error);
          const tenantSlug = 'dev-tenant';
          jiraUrl = `${process.env.APP_URL}/auth/jira/${tenantSlug}?userId=${userId}`;
          jiraButtonText = '🔗 JIRA 연결하기';
        }
        
        // JIRA 버튼 추가
        actionElements.push({
          type: 'button',
          text: {
            type: 'plain_text',
            text: jiraButtonText
          },
          url: jiraUrl,
          action_id: jiraUrl.includes('atlassian.com') || jiraUrl.includes('.atlassian.net') ? 'view_jira' : 'connect_jira'
        });

        // Notion 버튼 추가 (JIRA 뒤에)
        actionElements.push({
          type: 'button',
          text: {
            type: 'plain_text',
            text: notionButtonText
          },
          url: notionUrl,
          action_id: notionUrl.includes('notion.so') ? 'view_notion' : 'connect_notion'
        });
        
        // 결과 메시지 전송
        await client.chat.postMessage({
          channel: channelId,
          text: '✅ 프로젝트 생성이 완료되었습니다!',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `🎯 *${projectName}*\n\n✅ AI 분석이 완료되어 업무가 자동 생성되었습니다!\n\n${notionButtonText.includes('연결하기') ? '🔗 외부 서비스에 연결하여 더 많은 기능을 사용하세요.' : '📋 생성된 문서와 업무를 확인하세요.'}`
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `📊 *생성된 업무 수:* ${result.meetingData?.action_items?.length || result.meetingData?.tasks?.length || 0}개\n⏱️ *총 예상 시간:* ${(result.meetingData?.action_items || result.meetingData?.tasks || []).reduce((total, task) => total + (task.estimated_hours || 0), 0)}시간`
              }
            },
            ...(actionElements.length > 0 ? [{
              type: 'actions',
              elements: actionElements
            }] : [])
          ]
        });
        
      } else {
        // AI 서비스가 없는 경우 데모 응답 (기존 코드 유지)
        await client.chat.postMessage({
          channel: channelId,
          text: '✅ 데모: 음성 분석 완료!',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `🎯 *${projectName}*\n\n✅ 데모 모드로 프로젝트가 생성되었습니다.\n📁 처리된 파일: ${latestFile.name}`
              }
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '🔗 Notion 연결하기 (데모)'
                  },
                  url: `${process.env.APP_URL}/auth/notion/dev-tenant?userId=${userId}`,
                  action_id: 'connect_notion_demo'
                },
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '🔗 JIRA 연결하기 (데모)'
                  },
                  url: `${process.env.APP_URL}/auth/jira/dev-tenant?userId=${userId}`,
                  action_id: 'connect_jira_demo'
                }
              ]
            }
          ]
        });
      }
      
    } catch (error) {
      console.error('❌ AI 처리 오류:', error);
      await client.chat.postMessage({
        channel: channelId,
        text: `❌ AI 처리 중 오류가 발생했습니다: ${error.message}`
      });
    }
    
    // 임시 데이터 정리
    delete global.pendingProjects[userId];
    
  } catch (error) {
    console.error('❌ 파일 검색 오류:', error);
    await client.chat.postMessage({
      channel: channelId || userId,
      text: `❌ 파일 검색 중 오류가 발생했습니다: ${error.message}`
    });
    
    delete global.pendingProjects[userId];
  }
}

module.exports = { slackApp: app };