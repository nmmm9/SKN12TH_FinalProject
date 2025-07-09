/**
 * OAuth 인증 라우트
 * 외부 서비스 OAuth 플로우 처리
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { OAuthService } from '../services/oauth';
import { logger } from '../utils/logger';

const router = express.Router();
const prisma = new PrismaClient();
const oauthService = new OAuthService(prisma);

// ===== Slack OAuth =====

/**
 * Slack OAuth 인증 URL 생성
 * GET /auth/slack/url?tenant_id=xxx&user_id=xxx
 */
router.get('/slack/url', async (req, res) => {
  try {
    const { tenant_id, user_id } = req.query;
    
    if (!tenant_id || !user_id) {
      return res.status(400).json({ 
        error: 'tenant_id와 user_id가 필요합니다' 
      });
    }

    const authUrl = await oauthService.generateSlackAuthUrl(
      tenant_id as string, 
      user_id as string
    );
    
    logger.info(`Slack OAuth URL 생성: ${tenant_id}`);
    return res.json({ authUrl, service: 'slack' });
    
  } catch (error) {
    logger.error('Slack OAuth URL 생성 실패:', error);
    return res.status(500).json({ error: 'OAuth URL 생성 실패' });
  }
});

/**
 * Slack OAuth 콜백 처리
 * GET /auth/slack/callback?code=xxx&state=xxx
 */
router.get('/slack/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      logger.warn(`Slack OAuth 거부: ${error}`);
      return res.redirect(`${process.env.APP_URL}/auth/error?service=slack&error=${error}`);
    }

    if (!code || !state) {
      return res.status(400).json({ 
        error: 'code와 state가 필요합니다' 
      });
    }

    const result = await oauthService.handleSlackCallback(
      code as string, 
      state as string
    );
    
    logger.info(`Slack OAuth 성공: 테넌트 ${result.tenant.name}`);
    
    // 성공 페이지로 리다이렉트 (나중에 프론트엔드 구현시)
    return res.json({ 
      success: true, 
      message: 'Slack 연동이 완료되었습니다!',
      tenant: result.tenant.name
    });
    
  } catch (error) {
    logger.error('Slack OAuth 콜백 실패:', error);
    return res.status(500).json({ error: 'OAuth 콜백 처리 실패' });
  }
});

// ===== Notion OAuth =====

/**
 * Notion OAuth 인증 URL 생성
 */
router.get('/notion/url', async (req, res) => {
  try {
    const { tenant_id, user_id } = req.query;
    
    if (!tenant_id || !user_id) {
      return res.status(400).json({ 
        error: 'tenant_id와 user_id가 필요합니다' 
      });
    }

    const authUrl = await oauthService.generateNotionAuthUrl(
      tenant_id as string, 
      user_id as string
    );
    
    logger.info(`Notion OAuth URL 생성: ${tenant_id}`);
    return res.json({ authUrl, service: 'notion' });
    
  } catch (error) {
    logger.error('Notion OAuth URL 생성 실패:', error);
    return res.status(500).json({ error: 'OAuth URL 생성 실패' });
  }
});

/**
 * Notion OAuth 콜백 처리
 */
router.get('/notion/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      logger.warn(`Notion OAuth 거부: ${error}`);
      return res.redirect(`${process.env.APP_URL}/auth/error?service=notion&error=${error}`);
    }

    if (!code || !state) {
      return res.status(400).json({ 
        error: 'code와 state가 필요합니다' 
      });
    }

    const result = await oauthService.handleNotionCallback(
      code as string, 
      state as string
    );
    
    logger.info(`Notion OAuth 성공: 사용자 ${result.user.name}`);
    
    return res.json({ 
      success: true, 
      message: 'Notion 연동이 완료되었습니다!',
      workspace: (result.workspaceInfo as any)?.name || 'Unknown'
    });
    
  } catch (error) {
    logger.error('Notion OAuth 콜백 실패:', error);
    return res.status(500).json({ error: 'OAuth 콜백 처리 실패' });
  }
});

// ===== Jira OAuth =====

/**
 * Jira OAuth 인증 URL 생성
 */
router.get('/jira/url', async (req, res) => {
  try {
    const { tenant_id, user_id } = req.query;
    
    if (!tenant_id || !user_id) {
      return res.status(400).json({ 
        error: 'tenant_id와 user_id가 필요합니다' 
      });
    }

    const authUrl = await oauthService.generateJiraAuthUrl(
      tenant_id as string, 
      user_id as string
    );
    
    logger.info(`Jira OAuth URL 생성: ${tenant_id}`);
    return res.json({ authUrl, service: 'jira' });
    
  } catch (error) {
    logger.error('Jira OAuth URL 생성 실패:', error);
    return res.status(500).json({ error: 'OAuth URL 생성 실패' });
  }
});

/**
 * Jira OAuth 콜백 처리
 */
router.get('/jira/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      logger.warn(`Jira OAuth 거부: ${error}`);
      return res.redirect(`${process.env.APP_URL}/auth/error?service=jira&error=${error}`);
    }

    if (!code || !state) {
      return res.status(400).json({ 
        error: 'code와 state가 필요합니다' 
      });
    }

    const result = await oauthService.handleJiraCallback(
      code as string, 
      state as string
    );
    
    logger.info(`Jira OAuth 성공: 사용자 ${result.user.name}`);
    
    return res.json({ 
      success: true, 
      message: 'Jira 연동이 완료되었습니다!',
      sites: result.accessibleSites || []
    });
    
  } catch (error) {
    logger.error('Jira OAuth 콜백 실패:', error);
    return res.status(500).json({ error: 'OAuth 콜백 처리 실패' });
  }
});

// ===== Google OAuth =====

/**
 * Google OAuth 인증 URL 생성
 */
router.get('/google/url', async (req, res) => {
  try {
    const { tenant_id, user_id } = req.query;
    
    if (!tenant_id || !user_id) {
      return res.status(400).json({ 
        error: 'tenant_id와 user_id가 필요합니다' 
      });
    }

    const authUrl = await oauthService.generateGoogleAuthUrl(
      tenant_id as string, 
      user_id as string
    );
    
    logger.info(`Google OAuth URL 생성: ${tenant_id}`);
    return res.json({ authUrl, service: 'google' });
    
  } catch (error) {
    logger.error('Google OAuth URL 생성 실패:', error);
    return res.status(500).json({ error: 'OAuth URL 생성 실패' });
  }
});

/**
 * Google OAuth 콜백 처리
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      logger.warn(`Google OAuth 거부: ${error}`);
      return res.redirect(`${process.env.APP_URL}/auth/error?service=google&error=${error}`);
    }

    if (!code || !state) {
      return res.status(400).json({ 
        error: 'code와 state가 필요합니다' 
      });
    }

    const result = await oauthService.handleGoogleCallback(
      code as string, 
      state as string
    );
    
    logger.info(`Google OAuth 성공: 사용자 ${result.user.name}`);
    
    return res.json({ 
      success: true, 
      message: 'Google Calendar 연동이 완료되었습니다!',
      email: (result.userInfo as any)?.email || 'Unknown'
    });
    
  } catch (error) {
    logger.error('Google OAuth 콜백 실패:', error);
    return res.status(500).json({ error: 'OAuth 콜백 처리 실패' });
  }
});

// ===== 연동 상태 조회 =====

/**
 * 사용자별 연동 상태 조회
 * GET /auth/status?tenant_id=xxx&user_id=xxx
 */
router.get('/status', async (req, res) => {
  try {
    const { tenant_id, user_id } = req.query;
    
    if (!tenant_id || !user_id) {
      return res.status(400).json({ 
        error: 'tenant_id와 user_id가 필요합니다' 
      });
    }

    const integrations = await prisma.integration.findMany({
      where: {
        tenantId: tenant_id as string,
        userId: user_id as string,
        status: 'active'
      },
      select: {
        serviceType: true,
        serviceName: true,
        status: true,
        createdAt: true,
        expiresAt: true
      }
    });

    return res.json({ 
      integrations,
      totalConnected: integrations.length
    });
    
  } catch (error) {
    logger.error('연동 상태 조회 실패:', error);
    return res.status(500).json({ error: '연동 상태 조회 실패' });
  }
});

export default router;