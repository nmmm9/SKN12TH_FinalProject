/**
 * Multi-tenant 관련 타입 정의
 */

// 테넌트 정보
export interface Tenant {
  id: string;
  name: string;
  domain?: string;
  slackTeamId: string;
  planType: 'free' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'deleted';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  settings?: Record<string, any>;
  maxUsers: number;
  maxMeetings: number;
  storageUsedMB: number;
  createdAt: Date;
  updatedAt: Date;
}

// 테넌트별 사용자
export interface TenantUser {
  id: string;
  tenantId: string;
  slackUserId: string;
  slackEmail?: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'manager' | 'member';
  permissions?: Record<string, boolean>;
  primarySkills?: string;
  experienceLevel: number;
  maxWorkload: number;
  currentWorkload: number;
  status: 'active' | 'suspended' | 'deleted';
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// OAuth 통합 정보
export interface Integration {
  id: string;
  tenantId: string;
  userId: string;
  serviceType: 'notion' | 'jira' | 'calendar' | 'github';
  serviceName?: string;
  accessToken: string; // 암호화된 토큰
  refreshToken?: string; // 암호화된 토큰
  expiresAt?: Date;
  workspaceInfo?: Record<string, any>;
  status: 'active' | 'expired' | 'revoked';
  createdAt: Date;
  updatedAt: Date;
}

// 요청 컨텍스트 (미들웨어에서 설정)
export interface TenantContext {
  tenant: Tenant;
  user: TenantUser;
  permissions: string[];
}

// OAuth 설정
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

// 서비스별 OAuth 설정
export interface ServiceOAuthConfigs {
  notion: OAuthConfig;
  jira: OAuthConfig;
  google: OAuthConfig;
  github: OAuthConfig;
}

// 테넌트 생성 요청
export interface CreateTenantRequest {
  name: string;
  slackTeamId: string;
  domain?: string;
  adminUser: {
    slackUserId: string;
    email: string;
    name: string;
  };
}

// 테넌트 사용량 통계
export interface TenantUsageStats {
  tenantId: string;
  meetingCount: number;
  taskCount: number;
  userCount: number;
  storageUsedMB: number;
  periodStart: Date;
  periodEnd: Date;
  periodType: 'daily' | 'weekly' | 'monthly';
}

// 감사 로그
export interface AuditLog {
  id: string;
  tenantId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}