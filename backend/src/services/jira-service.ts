/**
 * JIRA 연동 서비스
 * Task Master에서 생성된 업무를 JIRA 이슈로 자동 생성
 */

import { PrismaClient } from '@prisma/client';
// import fetch from 'node-fetch'; // Node.js 18+ has built-in fetch

interface JiraIssue {
  key: string;
  id: string;
  summary: string;
  description: string;
  status: string;
  priority: string;
  assignee?: {
    accountId: string;
    displayName: string;
  };
}

interface JiraCreateIssueRequest {
  summary: string;
  description: string;
  issueType: string;
  priority: string;
  assignee?: string | undefined;
  parentKey?: string | undefined; // 서브태스크인 경우
}

interface JiraCreateIssueResponse {
  key: string;
  id: string;
  self: string;
}

class JiraService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 테넌트의 JIRA 설정 조회
   */
  async getJiraIntegration(tenantId: string, userId: string) {
    return await this.prisma.integration.findFirst({
      where: {
        tenantId,
        userId,
        serviceType: 'JIRA',
        isActive: true
      }
    });
  }

  /**
   * 테넌트의 기본 JIRA 설정 조회 (간단한 설정)
   */
  async getDefaultJiraProject(tenantId: string) {
    // 단순화된 구조에서는 Integration 테이블의 config에서 JIRA 설정을 가져옴
    const integration = await this.prisma.integration.findFirst({
      where: {
        tenantId,
        serviceType: 'JIRA',
        isActive: true
      }
    });

    if (!integration || !integration.config) {
      return null;
    }

    const config = integration.config as any;
    return {
      jiraProjectKey: config.defaultProjectKey || 'TASK',
      defaultIssueType: config.defaultIssueType || 'Task',
      defaultPriority: config.defaultPriority || 'Medium',
      priorityMapping: config.priorityMapping || {
        HIGH: 'High',
        MEDIUM: 'Medium',
        LOW: 'Low'
      }
    };
  }

  /**
   * JIRA API 호출
   */
  private async callJiraAPI(
    integration: any,
    endpoint: string,
    method: string = 'GET',
    data?: any
  ) {
    const config = integration.config || {};
    const baseUrl = config.site_url;
    
    if (!baseUrl) {
      throw new Error('JIRA site URL not configured');
    }

    // 토큰 복호화
    const decrypt = (encryptedText: string) => {
      return Buffer.from(encryptedText, 'base64').toString();
    };

    const url = `${baseUrl}/rest/api/3${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${decrypt(integration.accessToken)}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const response = await fetch(url, {
      method,
      headers,
      ...(data && { body: JSON.stringify(data) })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`JIRA API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * JIRA 이슈 생성
   */
  async createJiraIssue(
    tenantId: string,
    userId: string,
    request: JiraCreateIssueRequest
  ): Promise<JiraCreateIssueResponse> {
    const integration = await this.getJiraIntegration(tenantId, userId);
    if (!integration) {
      throw new Error('JIRA integration not found');
    }

    const jiraProject = await this.getDefaultJiraProject(tenantId);
    if (!jiraProject) {
      throw new Error('Default JIRA project not configured');
    }

    // 우선순위 매핑
    const priorityMapping = jiraProject.priorityMapping || {
      HIGH: 'High',
      MEDIUM: 'Medium',
      LOW: 'Low'
    };

    // Epic의 경우 특별한 필드 처리
    const issueData: any = {
      fields: {
        project: {
          key: jiraProject.jiraProjectKey
        },
        summary: request.summary,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: request.description
                }
              ]
            }
          ]
        },
        issuetype: {
          name: request.issueType === 'Epic' ? 'Epic' : 
                request.parentKey ? 'Sub-task' : 
                (request.issueType || jiraProject.defaultIssueType)
        },
        priority: {
          name: priorityMapping[request.priority] || jiraProject.defaultPriority
        },
        ...(request.assignee && {
          assignee: {
            accountId: request.assignee
          }
        })
      }
    };

    // Epic의 경우 Epic Name 필드 추가 (일부 JIRA 인스턴스에서 필요)
    if (request.issueType === 'Epic') {
      issueData.fields.customfield_10011 = request.summary; // Epic Name (필드 ID는 환경마다 다를 수 있음)
    }

    // Sub-task의 경우 parent 필드 추가
    if (request.parentKey) {
      issueData.fields.parent = {
        key: request.parentKey
      };
    }

    // Task가 Epic에 속하는 경우 Epic Link 필드 추가
    if (request.issueType === 'Task' && request.parentKey) {
      issueData.fields.customfield_10014 = request.parentKey; // Epic Link (필드 ID는 환경마다 다를 수 있음)
      delete issueData.fields.parent; // Task는 parent가 아닌 Epic Link 사용
    }

    const result = await this.callJiraAPI(integration, '/issue', 'POST', issueData) as any;
    
    return {
      key: result.key,
      id: result.id,
      self: result.self
    };
  }

  /**
   * TaskMaster에서 생성된 Task와 Subtask를 JIRA에 올바르게 매핑
   * TaskMaster TASK → JIRA Epic
   * TaskMaster SUBTASK → JIRA Task (Epic에 연결)
   */
  async syncTaskMasterToJira(
    tenantId: string, 
    userId: string, 
    projectData: {
      title: string;
      overview: string;
      tasks: Array<{
        title: string;
        description: string;
        priority: string;
        estimated_hours: number;
        complexity: string;
        subtasks?: Array<{
          title: string;
          description: string;
          estimated_hours: number;
        }>;
      }>;
    }
  ) {
    const results: any[] = [];
    const epics: string[] = [];
    
    try {
      console.log('🎫 TaskMaster → JIRA 매핑 시작:', projectData.title);
      
      // TaskMaster의 각 TASK를 JIRA Epic으로 생성
      for (const task of projectData.tasks) {
        try {
          // 1. TaskMaster TASK → JIRA Epic
          const epicIssue = await this.createJiraIssue(tenantId, userId, {
            summary: task.title,
            description: task.description,
            issueType: 'Epic',
            priority: task.priority || 'MEDIUM'
          });
          
          console.log(`✅ Epic 생성 (TaskMaster Task): ${epicIssue.key} - ${task.title}`);
          epics.push(epicIssue.key);
          results.push({
            type: 'Epic',
            key: epicIssue.key,
            title: task.title,
            source: 'TaskMaster Task',
            success: true
          });
          
          // 2. TaskMaster SUBTASK들을 JIRA Task로 생성 (Epic에 연결)
          if (task.subtasks && task.subtasks.length > 0) {
            for (const subtask of task.subtasks) {
              try {
                const jiraTaskIssue = await this.createJiraIssue(tenantId, userId, {
                  summary: subtask.title,
                  description: subtask.description,
                  issueType: 'Task',
                  priority: 'MEDIUM',
                  parentKey: epicIssue.key // Epic에 연결
                });
                
                console.log(`✅ Task 생성 (TaskMaster Subtask): ${jiraTaskIssue.key} - ${subtask.title}`);
                results.push({
                  type: 'Task',
                  key: jiraTaskIssue.key,
                  title: subtask.title,
                  parentKey: epicIssue.key,
                  source: 'TaskMaster Subtask',
                  success: true
                });
              } catch (subtaskError) {
                console.error(`❌ Task 생성 실패 (TaskMaster Subtask: ${subtask.title}):`, subtaskError);
                results.push({
                  type: 'Task',
                  title: subtask.title,
                  parentKey: epicIssue.key,
                  source: 'TaskMaster Subtask',
                  error: subtaskError instanceof Error ? subtaskError.message : 'Unknown error',
                  success: false
                });
              }
            }
          }
          
        } catch (taskError) {
          console.error(`❌ Epic 생성 실패 (TaskMaster Task: ${task.title}):`, taskError);
          results.push({
            type: 'Epic',
            title: task.title,
            source: 'TaskMaster Task',
            error: taskError instanceof Error ? taskError.message : 'Unknown error',
            success: false
          });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;
      const epicsCreated = results.filter(r => r.type === 'Epic' && r.success).length;
      const tasksCreated = results.filter(r => r.type === 'Task' && r.success).length;
      
      console.log(`✅ JIRA 매핑 완료: Epic ${epicsCreated}개, Task ${tasksCreated}개 (총 ${successCount}/${totalCount})`);
      
      return {
        success: true,
        epics: epics,
        totalCreated: successCount,
        totalAttempted: totalCount,
        epicsCreated,
        tasksCreated,
        results
      };
      
    } catch (error) {
      console.error('❌ TaskMaster → JIRA 매핑 실패:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        results
      };
    }
  }

  /**
   * Task를 JIRA 이슈로 동기화
   */
  async syncTaskToJira(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        tenant: true,
        assignee: true,
        parent: {
          include: {
            metadata: true
          }
        },
        children: true,
        metadata: true
      }
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // 이미 동기화된 경우 스킵
    if (task.metadata?.jiraStatus === 'synced' && task.metadata?.jiraIssueKey) {
      return task.metadata.jiraIssueKey;
    }

    try {
      // 동기화 시작 - TaskMetadata 업데이트
      await this.prisma.taskMetadata.upsert({
        where: { taskId },
        update: { jiraStatus: 'syncing' },
        create: { taskId, jiraStatus: 'syncing' }
      });

      // 부모 태스크가 있는 경우 부모를 먼저 동기화
      let parentJiraKey = null;
      if (task.parent && !task.parent.metadata?.jiraIssueKey) {
        parentJiraKey = await this.syncTaskToJira(task.parent.id, userId);
      } else if (task.parent) {
        parentJiraKey = task.parent.metadata?.jiraIssueKey;
      }

      // JIRA 이슈 생성
      const jiraIssue = await this.createJiraIssue(task.tenantId, userId, {
        summary: task.title,
        description: task.description || '',
        issueType: parentJiraKey ? 'Sub-task' : 'Task',
        priority: task.priority,
        assignee: task.assignee?.jiraUserId || undefined,
        parentKey: parentJiraKey || undefined
      });

      // TaskMetadata 업데이트
      await this.prisma.taskMetadata.upsert({
        where: { taskId },
        update: {
          jiraIssueKey: jiraIssue.key,
          jiraStatus: 'synced'
        },
        create: {
          taskId,
          jiraIssueKey: jiraIssue.key,
          jiraStatus: 'synced'
        }
      });

      return jiraIssue.key;

    } catch (error) {
      // 동기화 실패
      await this.prisma.taskMetadata.upsert({
        where: { taskId },
        update: { jiraStatus: 'failed' },
        create: { taskId, jiraStatus: 'failed' }
      });

      throw error;
    }
  }

  /**
   * 프로젝트에서 생성된 모든 업무를 JIRA로 동기화
   */
  async syncProjectTasksToJira(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          include: {
            metadata: true
          },
          orderBy: { taskNumber: 'asc' }
        }
      }
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const results = [];
    
    // 아직 동기화되지 않은 task만 필터링
    const pendingTasks = project.tasks.filter(task => 
      !task.metadata?.jiraStatus || 
      task.metadata.jiraStatus === 'pending' || 
      task.metadata.jiraStatus === 'failed'
    );
    
    // 부모 태스크부터 순차적으로 동기화 (taskNumber 순서)
    for (const task of pendingTasks) {
      try {
        const jiraKey = await this.syncTaskToJira(task.id, userId);
        results.push({ taskId: task.id, jiraKey, success: true });
      } catch (error) {
        results.push({ 
          taskId: task.id, 
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false 
        });
      }
    }

    return results;
  }

  /**
   * JIRA 연동 상태 확인
   */
  async checkJiraConnection(tenantId: string, userId: string) {
    const integration = await this.getJiraIntegration(tenantId, userId);
    if (!integration) {
      return { connected: false, error: 'Integration not found' };
    }

    try {
      const result = await this.callJiraAPI(integration, '/myself');
      return { connected: true, user: result };
    } catch (error) {
      return { 
        connected: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

export { JiraService };