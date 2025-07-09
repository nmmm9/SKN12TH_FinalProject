/**
 * 인증 미들웨어
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError, AuthorizationError } from './errorHandler';
import { logger } from '../utils/logger';

// 사용자 타입 확장 (Multi-tenant 대응)
interface AuthenticatedUser {
  id: string;
  tenantId: string;  // teamId -> tenantId로 변경
  slackUserId: string;
  name: string;
  role: string;
  email?: string;
}

// Request 타입 확장은 tenant.ts에서 처리
// (중복 선언 방지)

/**
 * JWT 토큰 검증 미들웨어
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No valid authorization token provided');
    }

    const token = authHeader.substring(7); // "Bearer " 제거

    // JWT 토큰 검증
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET is not configured');
      throw new Error('Authentication configuration error');
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    
    // 토큰에서 사용자 정보 추출
    const user: AuthenticatedUser = {
      id: decoded.id,
      tenantId: decoded.tenantId,
      slackUserId: decoded.slackUserId,
      name: decoded.name,
      role: decoded.role,
      email: decoded.email,
    };

    // Request 객체에 사용자 정보 첨부 (tenant.ts 타입과 호환)
    req.user = user as any;

    logger.debug('User authenticated successfully', {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AuthenticationError('Invalid authentication token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AuthenticationError('Authentication token has expired'));
    } else {
      next(error);
    }
  }
};

/**
 * 선택적 인증 미들웨어 (토큰이 있으면 검증, 없어도 통과)
 */
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // 토큰이 있으면 검증
      await authMiddleware(req, res, next);
    } else {
      // 토큰이 없으면 그냥 통과
      next();
    }
  } catch (error) {
    next(error);
  }
};

/**
 * 역할 기반 인가 미들웨어
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthenticationError('Authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new AuthorizationError(
        `Access denied. Required roles: ${allowedRoles.join(', ')}`
      ));
      return;
    }

    next();
  };
};

/**
 * 팀 소유권 확인 미들웨어
 */
export const requireTeamAccess = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(new AuthenticationError('Authentication required'));
    return;
  }

  const requestedTenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;
  
  if (requestedTenantId && requestedTenantId !== (req.user as any).tenantId) {
    next(new AuthorizationError('Access denied to this tenant'));
    return;
  }

  next();
};

/**
 * Slack 인증 미들웨어
 */
export const slackAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Slack 요청 검증 로직
    const slackSignature = req.headers['x-slack-signature'] as string;
    const slackTimestamp = req.headers['x-slack-request-timestamp'] as string;
    const signingSecret = process.env.SLACK_SIGNING_SECRET;

    if (!slackSignature || !slackTimestamp || !signingSecret) {
      throw new AuthenticationError('Invalid Slack request');
    }

    // 타임스탬프 검증 (5분 이내)
    const timestamp = parseInt(slackTimestamp);
    const now = Math.floor(Date.now() / 1000);
    
    if (Math.abs(now - timestamp) > 300) {
      throw new AuthenticationError('Slack request timestamp too old');
    }

    // TODO: 실제 Slack 서명 검증 구현
    // const expectedSignature = generateSlackSignature(signingSecret, slackTimestamp, req.body);
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * JWT 토큰 생성 유틸리티
 */
export const generateJWT = (user: AuthenticatedUser): string => {
  const jwtSecret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(
    {
      id: user.id,
      tenantId: user.tenantId,
      slackUserId: user.slackUserId,
      name: user.name,
      role: user.role,
      email: user.email,
    },
    jwtSecret,
    { expiresIn } as jwt.SignOptions
  );
};

/**
 * 리프레시 토큰 생성 유틸리티
 */
export const generateRefreshToken = (userId: string): string => {
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  if (!refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET is not configured');
  }

  return jwt.sign({ userId }, refreshSecret, { expiresIn } as jwt.SignOptions);
};