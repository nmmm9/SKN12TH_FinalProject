/**
 * Rate Limiting 미들웨어
 */

import rateLimit from 'express-rate-limit';
import { TooManyRequestsError } from './errorHandler';

// 기본 Rate Limiter
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 최대 100 요청
  message: {
    error: {
      message: 'Too many requests from this IP, please try again later.',
      code: 'TOO_MANY_REQUESTS',
      statusCode: 429,
    }
  },
  standardHeaders: true, // Rate limit 정보를 헤더에 포함
  legacyHeaders: false,
});

// API별 특화 Rate Limiter
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1분
  max: 30, // 최대 30 요청
  message: {
    error: {
      message: 'API rate limit exceeded. Please slow down.',
      code: 'API_RATE_LIMIT_EXCEEDED',
      statusCode: 429,
    }
  },
});

// 파일 업로드 Rate Limiter (더 엄격)
export const uploadRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5분
  max: 5, // 최대 5 업로드
  message: {
    error: {
      message: 'File upload rate limit exceeded. Please wait before uploading again.',
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      statusCode: 429,
    }
  },
});

// AI 처리 Rate Limiter (가장 엄격)
export const aiProcessingRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10분
  max: 3, // 최대 3 처리
  message: {
    error: {
      message: 'AI processing rate limit exceeded. Please wait before requesting more processing.',
      code: 'AI_PROCESSING_RATE_LIMIT_EXCEEDED',
      statusCode: 429,
    }
  },
});

// 인증 관련 Rate Limiter
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 5, // 최대 5 로그인 시도
  message: {
    error: {
      message: 'Too many authentication attempts. Please try again later.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      statusCode: 429,
    }
  },
  skipSuccessfulRequests: true, // 성공한 요청은 카운트하지 않음
});