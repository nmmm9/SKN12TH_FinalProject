/**
 * Multi-tenant 미들웨어
 * 테넌트별 데이터 격리 및 권한 관리
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { Tenant, TenantUser, TenantContext } from '../types/tenant';
import { logger } from '../utils/logger';

// Express Request 확장
declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
      user?: TenantUser;
      tenantContext?: TenantContext;
    }
  }
}

export class TenantMiddleware {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Slack 요청에서 테넌트 정보 추출 및 설정
   */
  extractTenantFromSlack = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Slack 요청 헤더에서 팀 ID 추출
      const slackTeamId = req.headers['x-slack-team-id'] as string ||
                         req.body?.team_id ||
                         req.body?.team?.id;

      if (!slackTeamId) {
        logger.warn('No Slack team ID found in request');
        res.status(400).json({ error: 'Missing Slack team ID' });
        return;
      }

      // 테넌트 조회
      const tenant = await this.prisma.tenant.findUnique({
        where: { slackTeamId }
      });

      if (!tenant) {
        logger.warn(`Tenant not found for Slack team: ${slackTeamId}`);
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // 테넌트 상태 확인
      if (tenant.status !== 'active') {
        logger.warn(`Inactive tenant: ${tenant.id}`);
        res.status(403).json({ error: 'Tenant access suspended' });
        return;
      }

      req.tenant = tenant as Tenant;
      
      logger.debug(`Tenant identified: ${tenant.name} (${tenant.id})`);
      next();

    } catch (error) {
      logger.error(`Tenant extraction error: ${error}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Slack 사용자 인증 및 설정
   */
  authenticateSlackUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.tenant) {
        res.status(400).json({ error: 'Tenant not found' });
        return;
      }

      // Slack 사용자 ID 추출
      const slackUserId = req.headers['x-slack-user-id'] as string ||
                         req.body?.user_id ||
                         req.body?.user?.id;

      if (!slackUserId) {
        logger.warn('No Slack user ID found in request');
        res.status(400).json({ error: 'Missing Slack user ID' });
        return;
      }

      // 사용자 조회 또는 생성
      let user = await this.prisma.user.findUnique({
        where: {
          idx_users_tenant_slack: {
            tenantId: req.tenant.id,
            slackUserId
          }
        }
      });

      if (!user) {
        // 새 사용자 자동 생성 (Slack에서 첫 요청시)
        const slackUserInfo = await this.getSlackUserInfo(slackUserId, req.body);
        
        user = await this.prisma.user.create({
          data: {
            tenantId: req.tenant.id,
            slackUserId,
            slackEmail: slackUserInfo.email,
            email: slackUserInfo.email || `${slackUserId}@slack.user`,
            name: slackUserInfo.name || 'Unknown User',
            avatar: slackUserInfo.avatar,
            role: 'member'
          }
        });

        logger.info(`New user created: ${user.email} for tenant ${req.tenant.id}`);
      }

      // 사용자 상태 확인
      if (!user.isActive || user.status !== 'active') {
        logger.warn(`Inactive user: ${user.id}`);
        res.status(403).json({ error: 'User access denied' });
        return;
      }

      req.user = user as TenantUser;
      
      // 테넌트 컨텍스트 설정
      req.tenantContext = {
        tenant: req.tenant,
        user: req.user,
        permissions: await this.getUserPermissions(user)
      };

      logger.debug(`User authenticated: ${user.email} (${user.id})`);
      next();

    } catch (error) {
      logger.error(`User authentication error: ${error}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * 권한 확인 미들웨어
   */
  requirePermission = (permission: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.tenantContext) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const hasPermission = this.checkPermission(req.tenantContext, permission);
      
      if (!hasPermission) {
        logger.warn(`Permission denied: ${permission} for user ${req.user?.id}`);
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      next();
    };
  };

  /**
   * 역할 확인 미들웨어
   */
  requireRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!roles.includes(req.user.role)) {
        logger.warn(`Role denied: required ${roles}, user has ${req.user.role}`);
        res.status(403).json({ error: 'Insufficient role' });
        return;
      }

      next();
    };
  };

  /**
   * 테넌트 사용량 제한 확인
   */
  checkUsageLimits = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.tenant) {
        res.status(400).json({ error: 'Tenant not found' });
        return;
      }

      // 요청 타입에 따른 사용량 확인
      const resourceType = this.getResourceTypeFromRequest(req);
      const currentUsage = await this.getCurrentUsage(req.tenant.id, resourceType);
      const limit = this.getUsageLimit(req.tenant, resourceType);

      if (currentUsage >= limit) {
        logger.warn(`Usage limit exceeded: ${resourceType} for tenant ${req.tenant.id}`);
        res.status(429).json({ 
          error: 'Usage limit exceeded',
          current: currentUsage,
          limit,
          planType: req.tenant.planType
        });
        return;
      }

      next();

    } catch (error) {
      logger.error(`Usage limit check error: ${error}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * 데이터 접근 권한 확인 (Row Level Security)
   */
  checkDataAccess = (resourceType: string, operation: 'read' | 'write' | 'delete') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.tenantContext) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        const resourceId = req.params.id;
        if (resourceId) {
          const hasAccess = await this.checkResourceAccess(
            req.tenantContext.tenant.id,
            resourceType,
            resourceId,
            operation
          );

          if (!hasAccess) {
            logger.warn(`Data access denied: ${resourceType}:${resourceId} for tenant ${req.tenantContext.tenant.id}`);
            res.status(403).json({ error: 'Access denied to resource' });
            return;
          }
        }

        next();

      } catch (error) {
        logger.error(`Data access check error: ${error}`);
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  };

  /**
   * Slack 사용자 정보 추출
   */
  private getSlackUserInfo(slackUserId: string, requestBody: any): any {
    return {
      email: requestBody.user?.profile?.email || requestBody.user?.email,
      name: requestBody.user?.profile?.real_name || requestBody.user?.name || requestBody.user?.username,
      avatar: requestBody.user?.profile?.image_72 || requestBody.user?.avatar
    };
  }

  /**
   * 사용자 권한 조회
   */
  private async getUserPermissions(user: any): Promise<string[]> {
    const rolePermissions = {
      admin: ['*'], // 모든 권한
      manager: ['read:all', 'write:meeting', 'write:task', 'write:project'],
      member: ['read:own', 'write:meeting', 'write:task']
    };

    const basePermissions = rolePermissions[user.role as keyof typeof rolePermissions] || [];
    const customPermissions = user.permissions ? Object.keys(user.permissions).filter(p => user.permissions[p]) : [];

    return [...basePermissions, ...customPermissions];
  }

  /**
   * 권한 확인
   */
  private checkPermission(context: TenantContext, permission: string): boolean {
    // 관리자는 모든 권한
    if (context.user.role === 'admin' || context.permissions.includes('*')) {
      return true;
    }

    return context.permissions.includes(permission);
  }

  /**
   * 요청에서 리소스 타입 추출
   */
  private getResourceTypeFromRequest(req: Request): string {
    const path = req.path;
    if (path.includes('/meetings')) return 'meetings';
    if (path.includes('/tasks')) return 'tasks';
    if (path.includes('/projects')) return 'projects';
    if (path.includes('/users')) return 'users';
    return 'general';
  }

  /**
   * 현재 사용량 조회
   */
  private async getCurrentUsage(tenantId: string, resourceType: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const usage = await this.prisma.usageStats.findFirst({
      where: {
        tenantId,
        periodType: 'monthly',
        periodStart: startOfMonth
      }
    });

    if (!usage) return 0;

    switch (resourceType) {
      case 'meetings': return usage.meetingCount;
      case 'users': return usage.userCount;
      default: return 0;
    }
  }

  /**
   * 사용량 제한 조회
   */
  private getUsageLimit(tenant: Tenant, resourceType: string): number {
    const limits = {
      free: { meetings: 10, users: 5 },
      professional: { meetings: 100, users: 50 },
      enterprise: { meetings: -1, users: -1 } // unlimited
    };

    const planLimits = limits[tenant.planType as keyof typeof limits] || limits.free;
    return planLimits[resourceType as keyof typeof planLimits] || 0;
  }

  /**
   * 리소스 접근 권한 확인
   */
  private async checkResourceAccess(
    tenantId: string,
    resourceType: string,
    resourceId: string,
    operation: string
  ): Promise<boolean> {
    try {
      switch (resourceType) {
        case 'meeting':
          const meeting = await this.prisma.meeting.findUnique({
            where: { id: resourceId }
          });
          return meeting?.tenantId === tenantId;

        case 'task':
          const task = await this.prisma.task.findUnique({
            where: { id: resourceId }
          });
          return task?.tenantId === tenantId;

        case 'project':
          const project = await this.prisma.project.findUnique({
            where: { id: resourceId }
          });
          return project?.tenantId === tenantId;

        default:
          return false;
      }
    } catch (error) {
      logger.error(`Resource access check failed: ${error}`);
      return false;
    }
  }
}