# 🔐 OAuth 애플리케이션 설정 가이드

DdalKkak Multi-tenant SaaS를 위한 OAuth 애플리케이션 설정 방법을 단계별로 안내합니다.

## 📋 개요

Multi-tenant 아키텍처에서는 각 회사가 자신의 계정으로 외부 서비스에 연동합니다. 이를 위해 개발자는 **OAuth 애플리케이션**을 생성해야 하며, 개인 토큰은 더 이상 사용하지 않습니다.

### ❌ 이전 방식 (Single-tenant)
```
개발자 개인 토큰 → .env 파일 → 모든 사용자가 공유
```

### ✅ 새로운 방식 (Multi-tenant)
```
OAuth App 설정 → 각 회사별 개별 인증 → 안전한 토큰 관리
```

---

## 🚀 1. Slack OAuth App 설정

### 1.1 앱 생성
1. [Slack API](https://api.slack.com/apps) 접속
2. **"Create New App"** 클릭
3. **"From scratch"** 선택
4. App 정보 입력:
   - **App Name**: `DdalKkak`
   - **Development Slack Workspace**: 테스트용 워크스페이스 선택

### 1.2 HTTPS 터널링 설정 (필수!)
Slack은 OAuth 콜백에 HTTPS를 요구합니다. 로컬 개발을 위해 ngrok을 사용합니다.

#### ngrok 설치 및 설정
```bash
# Windows
winget install ngrok

# macOS
brew install ngrok

# 또는 https://ngrok.com/download 에서 직접 다운로드
```

#### ngrok으로 HTTPS 터널 생성
```bash
# DdalKkak 백엔드 서버가 실행 중인 상태에서 새 터미널 열기
ngrok http 3500

# 출력 예시:
# Session Status: online
# Forwarding: https://abc123.ngrok.io -> http://localhost:3500
```

⚠️ **중요**: `https://abc123.ngrok.io` 같은 URL을 복사해두세요!

### 1.3 OAuth 설정
1. 좌측 메뉴에서 **"OAuth & Permissions"** 클릭
2. **Redirect URLs** 섹션에서 **"Add New Redirect URL"** 클릭
3. **ngrok HTTPS URL 입력**: `https://abc123.ngrok.io/auth/slack/callback`
   - ✅ 개발용: `https://your-ngrok-url.ngrok.io/auth/slack/callback`
   - ✅ 프로덕션: `https://your-domain.com/auth/slack/callback`

### 1.4 권한(Scopes) 설정
**Bot Token Scopes**에 다음 권한 추가:
```
channels:read    # 채널 정보 읽기
chat:write      # 메시지 보내기
files:read      # 파일 읽기
users:read      # 사용자 정보 읽기
commands        # 슬래시 커맨드
```

### 1.5 설정값 복사
1. **"Basic Information"** 메뉴로 이동
2. 다음 값들을 복사:
   - **Client ID**
   - **Client Secret**
   - **Signing Secret**

### 1.6 .env 파일 설정
```env
# ngrok HTTPS URL로 APP_URL 업데이트 (중요!)
APP_URL=https://abc123.ngrok.io

# Slack OAuth 설정
SLACK_CLIENT_ID=1234567890.1234567890
SLACK_CLIENT_SECRET=1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
SLACK_SIGNING_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
```

**⚠️ 주의**: ngrok을 다시 시작할 때마다 URL이 바뀝니다. URL이 바뀌면:
1. Slack OAuth 설정의 Redirect URL 업데이트
2. .env 파일의 APP_URL 업데이트
3. 서버 재시작

---

## 🗒️ 2. Notion OAuth App 설정

### 2.1 Integration 생성
1. [Notion Developers](https://developers.notion.com/) 접속
2. **"View my integrations"** 클릭
3. **"New integration"** 클릭

### 2.2 기본 정보 입력
- **Name**: `DdalKkak`
- **Logo**: DdalKkak 로고 업로드
- **Organization**: 개발자 개인 계정 선택

### 2.3 Capabilities 설정
다음 권한 선택:
```
✅ Read content
✅ Update content  
✅ Insert content
✅ Read user information
```

### 2.4 OAuth 설정
1. **"Distribution"** 탭으로 이동
2. **"Public integration"** 선택
3. **OAuth Domain & URIs** 설정:
   - **Redirect URI**: `https://abc123.ngrok.io/auth/notion/callback` (ngrok URL 사용)
   - **Domain**: `abc123.ngrok.io` (ngrok 도메인)

### 2.5 설정값 복사
**"Secrets"** 탭에서 복사:
- **OAuth client ID**
- **OAuth client secret**

### 2.6 .env 파일 설정
```env
NOTION_CLIENT_ID=a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6
NOTION_CLIENT_SECRET=secret_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6
```

---

## 🎯 3. Jira OAuth App 설정

### 3.1 앱 생성
1. [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/) 접속
2. **"Create"** → **"OAuth 2.0 (3LO)"** 선택
3. **App name**: `DdalKkak`

### 3.2 Authorization 설정
1. **"Authorization"** 탭으로 이동
2. **"Configure"** 클릭
3. **Callback URL**: `https://abc123.ngrok.io/auth/jira/callback` (ngrok URL 사용)

### 3.3 Permissions 설정
**"Permissions"** 탭에서 다음 API 추가:
```
Jira Platform REST API
├── read:jira-work
├── write:jira-work  
├── read:jira-user
└── manage:jira-project
```

### 3.4 설정값 복사
**"Settings"** 탭에서 복사:
- **Client ID**
- **Secret**

### 3.5 .env 파일 설정
```env
JIRA_CLIENT_ID=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
JIRA_CLIENT_SECRET=A1B2c3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0
```

---

## 📅 4. Google OAuth App 설정

### 4.1 프로젝트 생성
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. **"Select a project"** → **"New Project"**
3. **Project name**: `DdalKkak`

### 4.2 Calendar API 활성화
1. **"APIs & Services"** → **"Library"**
2. **"Google Calendar API"** 검색 후 선택
3. **"Enable"** 클릭

### 4.3 OAuth Consent Screen 설정
1. **"APIs & Services"** → **"OAuth consent screen"**
2. **User Type**: **"External"** 선택
3. 앱 정보 입력:
   - **App name**: `DdalKkak`
   - **User support email**: 개발자 이메일
   - **Developer contact information**: 개발자 이메일

### 4.4 Credentials 생성
1. **"APIs & Services"** → **"Credentials"**
2. **"Create Credentials"** → **"OAuth client ID"**
3. **Application type**: **"Web application"**
4. **Name**: `DdalKkak Web Client`
5. **Authorized redirect URIs**: `https://abc123.ngrok.io/auth/google/callback` (ngrok URL 사용)

### 4.5 설정값 복사
- **Client ID**
- **Client secret**

### 4.6 .env 파일 설정
```env
GOOGLE_CLIENT_ID=123456789012-a1b2c3d4e5f6g7h8i9j0k1l2.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=A1B2c3D4e5F6g7H8i9J0k1L2
```

---

## 🐙 5. GitHub OAuth App 설정 (선택사항)

### 5.1 앱 생성
1. [GitHub Developer Settings](https://github.com/settings/applications/new) 접속
2. **Application name**: `DdalKkak`
3. **Homepage URL**: `https://abc123.ngrok.io` (ngrok URL 사용)
4. **Authorization callback URL**: `https://abc123.ngrok.io/auth/github/callback` (ngrok URL 사용)

### 5.2 설정값 복사
- **Client ID**
- **Client Secret**

### 5.3 .env 파일 설정
```env
GITHUB_CLIENT_ID=a1b2c3d4e5f6g7h8i9j0
GITHUB_CLIENT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
```

---

## 🔒 6. 보안 설정

### 6.1 암호화 키 생성
```bash
# 강력한 32바이트 암호화 키 생성
openssl rand -hex 32
```

### 6.2 .env 파일에 추가
```env
ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

---

## ✅ 7. 설정 완료 확인

### 7.1 .env 파일 최종 점검
모든 `YOUR-*-HERE` 값이 실제 값으로 교체되었는지 확인:

```env
# ✅ 올바른 예시
SLACK_CLIENT_ID=1234567890.1234567890
NOTION_CLIENT_ID=a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6

# ❌ 잘못된 예시 (교체 필요)
SLACK_CLIENT_ID=YOUR-SLACK-CLIENT-ID-HERE
NOTION_CLIENT_ID=YOUR-NOTION-CLIENT-ID-HERE
```

### 7.2 ngrok 및 서버 시작 순서

#### 1단계: 백엔드 서버 시작
```bash
# 터미널 1: 백엔드 서버 시작
cd backend && npm run dev
```

#### 2단계: ngrok 터널 생성
```bash
# 터미널 2: ngrok 시작 (새 터미널)
ngrok http 3500

# 출력되는 HTTPS URL 복사
# 예: https://abc123.ngrok.io
```

#### 3단계: .env 파일 업데이트
```bash
# .env 파일에 ngrok URL 설정
APP_URL=https://abc123.ngrok.io
```

#### 4단계: AI 엔진 시작
```bash
# 터미널 3: AI 엔진 시작 (새 터미널)
cd ai-engine && python main.py
```

#### 5단계: 서버 재시작 (APP_URL 변경 반영)
```bash
# 터미널 1에서 Ctrl+C로 서버 종료 후 재시작
npm run dev
```

### 7.3 ngrok URL 변경 시 해야 할 일
ngrok을 재시작하면 URL이 바뀝니다. 새 URL이 생성되면:

1. **모든 OAuth 앱의 Redirect URL 업데이트**:
   - Slack: `https://새URL.ngrok.io/auth/slack/callback`
   - Notion: `https://새URL.ngrok.io/auth/notion/callback`
   - Jira: `https://새URL.ngrok.io/auth/jira/callback`
   - Google: `https://새URL.ngrok.io/auth/google/callback`
   - GitHub: `https://새URL.ngrok.io/auth/github/callback`

2. **.env 파일 업데이트**:
   ```env
   APP_URL=https://새URL.ngrok.io
   ```

3. **백엔드 서버 재시작**

### 7.3 OAuth 연동 테스트
```bash
# 서버 헬스 체크
curl http://localhost:3500/health

# OAuth URL 생성 테스트 (추후 구현)
curl http://localhost:3500/auth/notion/url
```

---

## 🚨 주의사항

### 보안
- ⚠️ **절대로** Client Secret을 GitHub에 커밋하지 마세요
- ⚠️ `.env` 파일은 `.gitignore`에 포함되어 있는지 확인하세요
- ⚠️ 프로덕션에서는 HTTPS 필수 사용

### 개발 vs 프로덕션
| 환경 | Redirect URL | 도메인 |
|------|-------------|--------|
| 개발 | `http://localhost:3500/auth/*/callback` | `localhost:3500` |
| 프로덕션 | `https://yourdomain.com/auth/*/callback` | `yourdomain.com` |

### 트러블슈팅
1. **401 Unauthorized**: Client ID/Secret 확인
2. **Redirect URI mismatch**: URL 정확히 일치하는지 확인
3. **Scope 에러**: 필요한 권한이 모두 설정되었는지 확인

---

## 📞 지원

문제가 발생하면 다음 리소스를 참고하세요:

- [Slack API 문서](https://api.slack.com/docs)
- [Notion API 문서](https://developers.notion.com/docs)
- [Jira API 문서](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Google API 문서](https://developers.google.com/calendar/api)
- [GitHub API 문서](https://docs.github.com/en/developers/apps)

---

**🎉 설정 완료 후 각 회사는 자신의 계정으로 안전하게 DdalKkak을 사용할 수 있습니다!**