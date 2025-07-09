/**
 * OAuth 인증 서비스
 * Multi-tenant 환경에서 외부 서비스 OAuth 토큰 관리
 */

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

interface SlackOAuthResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: {
    id: string;
    name: string;
  };
  enterprise?: {
    id: string;
    name: string;
  };
  authed_user: {
    id: string;
    scope: string;
    access_token: string;
    token_type: string;
  };
  error?: string;
}

export class OAuthService {
  private prisma: PrismaClient;
  private encryptionKey: Buffer;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    
    // 암호화 키 설정 (32바이트)
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length !== 64) { // 32바이트 = 64 hex chars
      throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    }
    this.encryptionKey = Buffer.from(key, 'hex');
  }

  // ===== State 관리 =====

  /**
   * OAuth state 생성 (보안을 위한 랜덤 문자열)
   */
  private generateState(tenantId: string, userId: string): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(16).toString('hex');
    return `${tenantId}:${userId}:${timestamp}:${random}`;
  }

  /**
   * OAuth state 파싱
   */
  private parseState(state: string): { tenantId: string; userId: string } {
    const parts = state.split(':');
    if (parts.length < 2) {
      throw new Error('Invalid state format');
    }
    return {
      tenantId: parts[0] || '',
      userId: parts[1] || ''
    };
  }

  // ===== 암호화/복호화 =====

  /**
   * 토큰 암호화
   */
  private encryptToken(token: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * 토큰 복호화
   */
  private decryptToken(encryptedToken: string): string {
    const parts = encryptedToken.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted token format');
    }
    
    const iv = Buffer.from(parts[0]!, 'hex');
    const encrypted = parts[1]!;
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // ===== Slack OAuth =====

  /**
   * Slack OAuth 인증 URL 생성
   */
  async generateSlackAuthUrl(tenantId: string, userId: string): Promise<string> {
    const state = this.generateState(tenantId, userId);
    
    const params = new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      scope: 'channels:read,chat:write,files:read,users:read,commands',
      redirect_uri: `${process.env.APP_URL}/auth/slack/callback`,
      state,
      response_type: 'code'
    });
    
    logger.info(`Slack OAuth URL 생성: tenant=${tenantId}, user=${userId}`);
    return `https://slack.com/oauth/v2/authorize?${params}`;
  }

  /**
   * Slack OAuth 콜백 처리
   */
  async handleSlackCallback(code: string, state: string) {
    logger.info(`Slack OAuth 콜백 처리 시작: state=${state}`);
    
    const { tenantId, userId } = this.parseState(state);
    
    // 1. 코드를 토큰으로 교환
    const tokenResponse = await this.exchangeSlackCode(code);
    
    if (!tokenResponse.ok) {
      throw new Error(`Slack OAuth 실패: ${tokenResponse.error}`);
    }
    
    // 2. 팀 정보로 테넌트 생성/업데이트
    const tenant = await this.findOrCreateSlackTenant(tokenResponse);
    
    // 3. 사용자 정보 생성/업데이트
    const user = await this.findOrCreateSlackUser(tenant.id, tokenResponse);
    
    // 4. 통합 정보 저장
    await this.storeSlackIntegration(tenant.id, user.id, tokenResponse);
    
    logger.info(`Slack OAuth 완료: tenant=${tenant.name}, user=${user.name}`);
    
    return { tenant, user, teamInfo: tokenResponse.team };
  }

  private async exchangeSlackCode(code: string): Promise<SlackOAuthResponse> {
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: `${process.env.APP_URL}/auth/slack/callback`
      })
    });
    
    return await response.json() as SlackOAuthResponse;
  }

  private async findOrCreateSlackTenant(slackResponse: SlackOAuthResponse) {
    const slackTeamId = slackResponse.team.id;
    
    let tenant = await this.prisma.tenant.findUnique({
      where: { slackTeamId }
    });
    
    if (!tenant) {
      tenant = await this.prisma.tenant.create({
        data: {
          name: slackResponse.team.name,
          slackTeamId,
          planType: 'free',
          status: 'active'
        }
      });
      
      logger.info(`새 테넌트 생성: ${tenant.name} (${slackTeamId})`);
    }
    
    return tenant;
  }

  private async findOrCreateSlackUser(tenantId: string, slackResponse: SlackOAuthResponse) {
    const slackUserId = slackResponse.authed_user.id;
    
    let user = await this.prisma.user.findUnique({
      where: {
        idx_users_tenant_slack: {
          tenantId,
          slackUserId
        }
      }
    });
    
    if (!user) {
      // Slack API로 사용자 정보 조회
      const userInfo = await this.getSlackUserInfo(slackUserId, slackResponse.access_token);
      
      user = await this.prisma.user.create({
        data: {
          tenantId,
          slackUserId,
          slackEmail: userInfo.profile?.email,
          email: userInfo.profile?.email || `${slackUserId}@slack.local`,
          name: userInfo.profile?.real_name || userInfo.name || 'Unknown User',
          avatar: userInfo.profile?.image_192,
          role: 'member',
          status: 'active'
        }
      });
      
      logger.info(`새 사용자 생성: ${user.name} (${slackUserId})`);
    }
    
    return user;
  }

  private async getSlackUserInfo(userId: string, accessToken: string) {
    const response = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const data: any = await response.json();
    return data.user || {};
  }

  private async storeSlackIntegration(tenantId: string, userId: string, slackResponse: SlackOAuthResponse) {
    const encryptedAccessToken = this.encryptToken(slackResponse.access_token);
    const encryptedUserToken = this.encryptToken(slackResponse.authed_user.access_token);
    
    await this.prisma.integration.upsert({
      where: {
        idx_integrations_tenant_user_service: {
          tenantId,
          userId,
          serviceType: 'slack'
        }
      },
      update: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedUserToken,
        status: 'active',
        workspaceInfo: {
          teamId: slackResponse.team.id,
          teamName: slackResponse.team.name,
          botUserId: slackResponse.bot_user_id,
          appId: slackResponse.app_id
        }
      },
      create: {
        tenantId,
        userId,
        serviceType: 'slack',
        serviceName: `Slack - ${slackResponse.team.name}`,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedUserToken,
        status: 'active',
        workspaceInfo: {
          teamId: slackResponse.team.id,
          teamName: slackResponse.team.name,
          botUserId: slackResponse.bot_user_id,
          appId: slackResponse.app_id
        }
      }
    });
  }

  // ===== Notion OAuth =====

  async generateNotionAuthUrl(tenantId: string, userId: string): Promise<string> {
    const state = this.generateState(tenantId, userId);
    
    const params = new URLSearchParams({
      client_id: process.env.NOTION_CLIENT_ID!,
      response_type: 'code',
      owner: 'user',
      redirect_uri: `${process.env.APP_URL}/auth/notion/callback`,
      state
    });
    
    return `https://api.notion.com/v1/oauth/authorize?${params}`;
  }

  async handleNotionCallback(code: string, state: string) {
    const { tenantId, userId } = this.parseState(state);
    
    // 코드를 토큰으로 교환
    const tokenResponse = await this.exchangeNotionCode(code);
    
    // 사용자 정보 조회
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId }
    });
    
    // 워크스페이스 정보 조회 (Notion API)
    const workspaceInfo = await this.getNotionUserInfo(tokenResponse.access_token);
    
    // 통합 정보 저장
    await this.storeNotionIntegration(tenantId, userId, tokenResponse, workspaceInfo);
    
    return { user, workspaceInfo, tokenResponse };
  }

  private async exchangeNotionCode(code: string): Promise<any> {
    const auth = Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.APP_URL}/auth/notion/callback`
      })
    });
    
    return await response.json();
  }

  private async getNotionUserInfo(accessToken: string) {
    const response = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Notion-Version': '2022-06-28'
      }
    });
    
    return await response.json();
  }

  private async storeNotionIntegration(tenantId: string, userId: string, tokenResponse: any, workspaceInfo: any) {
    const encryptedToken = this.encryptToken(tokenResponse.access_token);
    
    await this.prisma.integration.upsert({
      where: {
        idx_integrations_tenant_user_service: {
          tenantId,
          userId,
          serviceType: 'notion'
        }
      },
      update: {
        accessToken: encryptedToken,
        status: 'active',
        workspaceInfo: {
          workspaceId: tokenResponse.workspace_id,
          workspaceName: tokenResponse.workspace_name,
          workspaceIcon: tokenResponse.workspace_icon,
          botId: tokenResponse.bot_id,
          owner: workspaceInfo
        }
      },
      create: {
        tenantId,
        userId,
        serviceType: 'notion',
        serviceName: `Notion - ${tokenResponse.workspace_name}`,
        accessToken: encryptedToken,
        status: 'active',
        workspaceInfo: {
          workspaceId: tokenResponse.workspace_id,
          workspaceName: tokenResponse.workspace_name,
          workspaceIcon: tokenResponse.workspace_icon,
          botId: tokenResponse.bot_id,
          owner: workspaceInfo
        }
      }
    });
  }

  // ===== Jira OAuth =====

  async generateJiraAuthUrl(tenantId: string, userId: string): Promise<string> {
    const state = this.generateState(tenantId, userId);
    
    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: process.env.JIRA_CLIENT_ID!,
      scope: 'read:jira-work write:jira-work read:jira-user manage:jira-project offline_access',
      redirect_uri: `${process.env.APP_URL}/auth/jira/callback`,
      state,
      response_type: 'code',
      prompt: 'consent'
    });
    
    return `https://auth.atlassian.com/authorize?${params}`;
  }

  async handleJiraCallback(code: string, state: string) {
    const { tenantId, userId } = this.parseState(state);
    
    const tokenResponse = await this.exchangeJiraCode(code) as any;
    const userInfo = await this.getJiraUserInfo(tokenResponse.access_token);
    const accessibleSites = await this.getJiraAccessibleSites(tokenResponse.access_token) as any[];
    
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId }
    });
    
    await this.storeJiraIntegration(tenantId, userId, tokenResponse, userInfo, accessibleSites);
    
    return { user, userInfo, accessibleSites };
  }

  private async exchangeJiraCode(code: string) {
    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.JIRA_CLIENT_ID!,
        client_secret: process.env.JIRA_CLIENT_SECRET!,
        code,
        redirect_uri: `${process.env.APP_URL}/auth/jira/callback`
      })
    });
    
    return await response.json();
  }

  private async getJiraUserInfo(accessToken: string) {
    const response = await fetch('https://api.atlassian.com/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    return await response.json();
  }

  private async getJiraAccessibleSites(accessToken: string) {
    const response = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });
    
    return await response.json();
  }

  private async storeJiraIntegration(tenantId: string, userId: string, tokenResponse: any, userInfo: any, sites: any[]) {
    const encryptedToken = this.encryptToken(tokenResponse.access_token);
    const encryptedRefreshToken = tokenResponse.refresh_token ? this.encryptToken(tokenResponse.refresh_token) : null;
    
    await this.prisma.integration.upsert({
      where: {
        idx_integrations_tenant_user_service: {
          tenantId,
          userId,
          serviceType: 'jira'
        }
      },
      update: {
        accessToken: encryptedToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: new Date(Date.now() + (tokenResponse.expires_in * 1000)),
        status: 'active',
        workspaceInfo: {
          userInfo,
          accessibleSites: sites,
          scopes: tokenResponse.scope?.split(' ') || []
        }
      },
      create: {
        tenantId,
        userId,
        serviceType: 'jira',
        serviceName: `Jira - ${sites[0]?.name || 'Unknown'}`,
        accessToken: encryptedToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: new Date(Date.now() + (tokenResponse.expires_in * 1000)),
        status: 'active',
        workspaceInfo: {
          userInfo,
          accessibleSites: sites,
          scopes: tokenResponse.scope?.split(' ') || []
        }
      }
    });
  }

  // ===== Google OAuth =====

  async generateGoogleAuthUrl(tenantId: string, userId: string): Promise<string> {
    const state = this.generateState(tenantId, userId);
    
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: `${process.env.APP_URL}/auth/google/callback`,
      scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      state
    });
    
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async handleGoogleCallback(code: string, state: string) {
    const { tenantId, userId } = this.parseState(state);
    
    const tokenResponse = await this.exchangeGoogleCode(code) as any;
    const userInfo = await this.getGoogleUserInfo(tokenResponse.access_token);
    
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId }
    });
    
    await this.storeGoogleIntegration(tenantId, userId, tokenResponse, userInfo);
    
    return { user, userInfo };
  }

  private async exchangeGoogleCode(code: string) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.APP_URL}/auth/google/callback`
      })
    });
    
    return await response.json();
  }

  private async getGoogleUserInfo(accessToken: string) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    return await response.json();
  }

  private async storeGoogleIntegration(tenantId: string, userId: string, tokenResponse: any, userInfo: any) {
    const encryptedToken = this.encryptToken(tokenResponse.access_token);
    const encryptedRefreshToken = tokenResponse.refresh_token ? this.encryptToken(tokenResponse.refresh_token) : null;
    
    await this.prisma.integration.upsert({
      where: {
        idx_integrations_tenant_user_service: {
          tenantId,
          userId,
          serviceType: 'google'
        }
      },
      update: {
        accessToken: encryptedToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: new Date(Date.now() + (tokenResponse.expires_in * 1000)),
        status: 'active',
        workspaceInfo: {
          userInfo,
          scopes: tokenResponse.scope?.split(' ') || []
        }
      },
      create: {
        tenantId,
        userId,
        serviceType: 'google',
        serviceName: `Google Calendar - ${userInfo.email}`,
        accessToken: encryptedToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: new Date(Date.now() + (tokenResponse.expires_in * 1000)),
        status: 'active',
        workspaceInfo: {
          userInfo,
          scopes: tokenResponse.scope?.split(' ') || []
        }
      }
    });
  }

  // ===== 토큰 조회 및 갱신 =====

  /**
   * 서비스별 액세스 토큰 조회
   */
  async getAccessToken(tenantId: string, userId: string, serviceType: string): Promise<string | null> {
    const integration = await this.prisma.integration.findUnique({
      where: {
        idx_integrations_tenant_user_service: {
          tenantId,
          userId,
          serviceType
        }
      }
    });
    
    if (!integration || integration.status !== 'active') {
      return null;
    }
    
    // 토큰 만료 확인
    if (integration.expiresAt && integration.expiresAt < new Date()) {
      // 토큰 갱신 시도
      if (integration.refreshToken) {
        await this.refreshAccessToken(integration);
        // 갱신된 토큰 다시 조회
        const refreshedIntegration = await this.prisma.integration.findUnique({
          where: { id: integration.id }
        });
        if (refreshedIntegration) {
          return this.decryptToken(refreshedIntegration.accessToken);
        }
      }
      return null;
    }
    
    return this.decryptToken(integration.accessToken);
  }

  private async refreshAccessToken(integration: any) {
    // 서비스별 토큰 갱신 로직 구현
    // 현재는 기본 구조만 제공
    logger.info(`토큰 갱신 필요: ${integration.serviceType}`);
  }
}