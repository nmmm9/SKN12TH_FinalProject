/**
 * 기본 시드 데이터 생성
 * 테스트용 테넌트 및 사용자 데이터
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 시드 데이터 생성 시작...');

  // 테스트 테넌트 생성
  const testTenant = await prisma.tenant.upsert({
    where: { slackTeamId: 'T1234567890' },
    update: {},
    create: {
      name: "Test Company",
      slackTeamId: "T1234567890",  // 임시 테스트 팀 ID
      planType: "free",
      status: "active",
      maxUsers: 10,
      maxMeetings: 50
    }
  });

  console.log('✅ 테스트 테넌트 생성됨:', {
    id: testTenant.id,
    name: testTenant.name,
    slackTeamId: testTenant.slackTeamId
  });

  // 테스트 사용자 생성
  const testUser = await prisma.user.upsert({
    where: { 
      idx_users_tenant_slack: {
        tenantId: testTenant.id,
        slackUserId: 'U1234567890'
      }
    },
    update: {},
    create: {
      tenantId: testTenant.id,
      slackUserId: 'U1234567890',
      slackEmail: 'test@example.com',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
      status: 'active'
    }
  });

  console.log('✅ 테스트 사용자 생성됨:', {
    id: testUser.id,
    name: testUser.name,
    email: testUser.email
  });

  // 테스트 프로젝트 생성
  const testProject = await prisma.project.create({
    data: {
      tenantId: testTenant.id,
      name: "DdalKkak MVP 개발",
      description: "DdalKkak 최소 기능 제품 개발 프로젝트",
      status: "active",
      priority: "high",
      createdBy: testUser.id
    }
  });

  console.log('✅ 테스트 프로젝트 생성됨:', {
    id: testProject.id,
    name: testProject.name
  });

  console.log('🎉 시드 데이터 생성 완료!');
}

main()
  .catch((e) => {
    console.error('❌ 시드 데이터 생성 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });