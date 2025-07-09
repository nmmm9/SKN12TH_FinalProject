/**
 * 환경 변수 검증 유틸리티
 * Multi-tenant OAuth 설정이 올바른지 확인
 */

import { logger } from './logger';

interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface RequiredEnvVars {
  [key: string]: {
    required: boolean;
    description: string;
    validator?: (value: string) => boolean;
    example?: string;
  };
}

const REQUIRED_ENV_VARS: RequiredEnvVars = {
  // 기본 서버 설정
  'NODE_ENV': {
    required: true,
    description: '실행 환경 (development, production)',
    validator: (val) => ['development', 'production', 'test'].includes(val)
  },
  'PORT': {
    required: true,
    description: '서버 포트 번호',
    validator: (val) => !isNaN(Number(val)) && Number(val) > 0
  },
  'DATABASE_URL': {
    required: true,
    description: 'PostgreSQL 데이터베이스 연결 URL',
    validator: (val) => val.startsWith('postgresql://')
  },

  // 보안 설정
  'JWT_SECRET': {
    required: true,
    description: 'JWT 토큰 서명용 비밀 키',
    validator: (val) => val.length >= 32
  },
  'ENCRYPTION_KEY': {
    required: true,
    description: 'OAuth 토큰 암호화용 AES-256 키 (64자 hex)',
    validator: (val) => /^[a-fA-F0-9]{64}$/.test(val),
    example: 'openssl rand -hex 32로 생성'
  },
  'APP_URL': {
    required: true,
    description: 'OAuth 콜백용 앱 기본 URL',
    validator: (val) => val.startsWith('http')
  },

  // Slack OAuth (개발 환경에서는 선택사항)
  'SLACK_CLIENT_ID': {
    required: process.env.NODE_ENV === 'production',
    description: 'Slack OAuth Client ID',
    validator: (val) => !val.includes('YOUR-') && val.length > 10
  },
  'SLACK_CLIENT_SECRET': {
    required: process.env.NODE_ENV === 'production',
    description: 'Slack OAuth Client Secret',
    validator: (val) => !val.includes('YOUR-') && val.length > 10
  },
  'SLACK_SIGNING_SECRET': {
    required: process.env.NODE_ENV === 'production',
    description: 'Slack 요청 서명 검증용 시크릿',
    validator: (val) => !val.includes('YOUR-') && val.length > 10
  },

  // Notion OAuth (개발 환경에서는 선택사항)
  'NOTION_CLIENT_ID': {
    required: process.env.NODE_ENV === 'production',
    description: 'Notion OAuth Client ID',
    validator: (val) => !val.includes('YOUR-') && val.includes('-')
  },
  'NOTION_CLIENT_SECRET': {
    required: process.env.NODE_ENV === 'production',
    description: 'Notion OAuth Client Secret',
    validator: (val) => !val.includes('YOUR-') && val.startsWith('secret_')
  },

  // Jira OAuth (개발 환경에서는 선택사항)
  'JIRA_CLIENT_ID': {
    required: process.env.NODE_ENV === 'production',
    description: 'Jira OAuth Client ID',
    validator: (val) => !val.includes('YOUR-') && val.length > 10
  },
  'JIRA_CLIENT_SECRET': {
    required: process.env.NODE_ENV === 'production',
    description: 'Jira OAuth Client Secret',
    validator: (val) => !val.includes('YOUR-') && val.length > 10
  },

  // Google OAuth (개발 환경에서는 선택사항)
  'GOOGLE_CLIENT_ID': {
    required: process.env.NODE_ENV === 'production',
    description: 'Google OAuth Client ID',
    validator: (val) => !val.includes('YOUR-') && val.endsWith('.apps.googleusercontent.com')
  },
  'GOOGLE_CLIENT_SECRET': {
    required: process.env.NODE_ENV === 'production',
    description: 'Google OAuth Client Secret',
    validator: (val) => !val.includes('YOUR-') && val.length > 10
  },

  // GitHub OAuth (선택사항)
  'GITHUB_CLIENT_ID': {
    required: false,
    description: 'GitHub OAuth Client ID (선택사항)',
    validator: (val) => !val.includes('YOUR-') && val.length > 10
  },
  'GITHUB_CLIENT_SECRET': {
    required: false,
    description: 'GitHub OAuth Client Secret (선택사항)',
    validator: (val) => !val.includes('YOUR-') && val.length > 10
  },

  // AI 엔진
  'AI_ENGINE_URL': {
    required: false,
    description: 'AI 엔진 서비스 URL',
    validator: (val) => val.startsWith('http')
  }
};

/**
 * 환경 변수 검증 실행
 */
export function validateEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [envKey, config] of Object.entries(REQUIRED_ENV_VARS)) {
    const value = process.env[envKey];

    // 필수 변수 누락 확인
    if (config.required && !value) {
      errors.push(`❌ ${envKey}: ${config.description} (필수)`);
      if (config.example) {
        errors.push(`   💡 생성 방법: ${config.example}`);
      }
      continue;
    }

    // 선택사항 변수 누락 경고
    if (!config.required && !value) {
      warnings.push(`⚠️  ${envKey}: ${config.description} (선택사항, 미설정)`);
      continue;
    }

    // 값이 있는 경우 유효성 검증
    if (value && config.validator && !config.validator(value)) {
      if (value.includes('YOUR-')) {
        errors.push(`❌ ${envKey}: 실제 값으로 교체 필요 (현재: ${value})`);
      } else {
        errors.push(`❌ ${envKey}: 형식이 올바르지 않음 (${config.description})`);
      }
    }
  }

  // 추가 보안 검증
  validateSecuritySettings(errors, warnings);

  // 개발/프로덕션 환경별 검증
  validateEnvironmentSpecific(errors, warnings);

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 보안 설정 검증
 */
function validateSecuritySettings(errors: string[], warnings: string[]): void {
  const nodeEnv = process.env.NODE_ENV;
  const encryptionKey = process.env.ENCRYPTION_KEY;
  const jwtSecret = process.env.JWT_SECRET;

  // 프로덕션 환경 보안 확인
  if (nodeEnv === 'production') {
    if (encryptionKey === 'ddalkkak_multitenant_encryption_key_32bytes_hex') {
      errors.push('❌ ENCRYPTION_KEY: 프로덕션에서 기본값 사용 금지');
    }

    if (jwtSecret === 'your_super_secret_jwt_key_development_12345') {
      errors.push('❌ JWT_SECRET: 프로덕션에서 기본값 사용 금지');
    }

    const appUrl = process.env.APP_URL;
    if (appUrl && !appUrl.startsWith('https://')) {
      warnings.push('⚠️  APP_URL: 프로덕션에서는 HTTPS 사용 권장');
    }
  }

  // 암호화 키 강도 확인
  if (encryptionKey && encryptionKey.length < 64) {
    errors.push('❌ ENCRYPTION_KEY: 최소 64자 (32바이트 hex) 필요');
  }

  // JWT 시크릿 강도 확인
  if (jwtSecret && jwtSecret.length < 32) {
    warnings.push('⚠️  JWT_SECRET: 32자 이상 권장');
  }
}

/**
 * 환경별 특정 검증
 */
function validateEnvironmentSpecific(errors: string[], warnings: string[]): void {
  const nodeEnv = process.env.NODE_ENV;
  const appUrl = process.env.APP_URL;

  if (nodeEnv === 'development') {
    if (appUrl && !appUrl.includes('localhost')) {
      warnings.push('⚠️  APP_URL: 개발 환경에서는 localhost 사용 권장');
    }
  }

  if (nodeEnv === 'production') {
    if (appUrl && appUrl.includes('localhost')) {
      errors.push('❌ APP_URL: 프로덕션에서 localhost 사용 불가');
    }
  }
}

/**
 * OAuth 콜백 URL 생성 및 검증
 */
export function validateOAuthCallbacks(): { service: string; url: string; valid: boolean }[] {
  const appUrl = process.env.APP_URL;
  const services = ['slack', 'notion', 'jira', 'google', 'github'];

  if (!appUrl) {
    return services.map(service => ({
      service,
      url: 'APP_URL 미설정',
      valid: false
    }));
  }

  return services.map(service => {
    const url = `${appUrl}/auth/${service}/callback`;
    const valid = url.startsWith('http') && !url.includes('undefined');
    
    return { service, url, valid };
  });
}

/**
 * 환경 변수 검증 결과 출력
 */
export function printValidationResult(result: EnvValidationResult): void {
  console.log('\n🔍 환경 변수 검증 결과\n');

  if (result.isValid) {
    console.log('✅ 모든 환경 변수가 올바르게 설정되었습니다!\n');
  } else {
    console.log('❌ 환경 변수 설정에 문제가 있습니다:\n');
  }

  // 오류 출력
  if (result.errors.length > 0) {
    console.log('🚨 오류 (수정 필요):');
    result.errors.forEach(error => console.log(`  ${error}`));
    console.log('');
  }

  // 경고 출력
  if (result.warnings.length > 0) {
    console.log('⚠️  경고 (권장 사항):');
    result.warnings.forEach(warning => console.log(`  ${warning}`));
    console.log('');
  }

  // OAuth 콜백 URL 출력
  const callbacks = validateOAuthCallbacks();
  console.log('🔗 OAuth 콜백 URL:');
  callbacks.forEach(({ service, url, valid }) => {
    const status = valid ? '✅' : '❌';
    console.log(`  ${status} ${service}: ${url}`);
  });
  console.log('');

  // 가이드 링크
  if (!result.isValid) {
    console.log('📖 설정 가이드: OAuth_설정_가이드.md 참조');
    console.log('🔧 .env.example 파일을 참고하여 설정을 완료하세요\n');
  }
}

/**
 * 애플리케이션 시작 시 환경 변수 검증
 */
export function validateAndExit(): void {
  const result = validateEnvironment();
  printValidationResult(result);

  if (!result.isValid) {
    logger.error('환경 변수 설정 오류로 인해 서버를 시작할 수 없습니다');
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    logger.warn(`${result.warnings.length}개의 환경 변수 경고사항이 있습니다`);
  }

  logger.info('환경 변수 검증 완료 ✅');
}