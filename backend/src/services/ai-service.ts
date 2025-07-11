/**
 * AI 서비스 - Runpod AI 서버와 연동
 * 로컬 백엔드에서 Runpod의 AI 엔진 호출
 */

import FormData from 'form-data';
import fetch from 'node-fetch';

interface TranscriptionResult {
  success: boolean;
  transcription?: {
    segments: any[];
    full_text: string;
    language: string;
    duration: number;
  };
  error?: string;
}

interface AnalysisResult {
  success: boolean;
  analysis?: {
    summary: string;
    action_items: Array<{
      task: string;
      assignee: string;
      deadline: string;
      priority: string;
    }>;
    decisions: string[];
    next_steps: string[];
    key_points: string[];
  };
  error?: string;
}

interface PipelineResult {
  success: boolean;
  transcription?: any;
  analysis?: any;
  analysis_success?: boolean;
  step?: string;
  error?: string;
}

interface NotionProjectResult {
  success: boolean;
  notion_project?: {
    title: string;
    overview: string;
    objectives: string[];
    key_deliverables: string[];
    timeline: string;
    stakeholders: string[];
    technical_requirements: string[];
    risks_and_mitigations: string[];
    success_metrics: string[];
    next_steps: string[];
  };
  error?: string;
}

interface TaskMasterPRDResult {
  success: boolean;
  prd?: {
    title: string;
    overview: string;
    scope: string;
    user_stories: Array<{
      title: string;
      description: string;
      acceptance_criteria: string[];
      priority: string;
      estimated_hours: number;
    }>;
    technical_requirements: string[];
    constraints: string[];
    success_metrics: string[];
  };
  error?: string;
}

interface GeneratedTasksResult {
  success: boolean;
  tasks?: Array<{
    title: string;
    description: string;
    priority: string;
    estimated_hours: number;
    complexity: string;
    subtasks: Array<{
      title: string;
      description: string;
      estimated_hours: number;
    }>;
    dependencies: string[];
    acceptance_criteria: string[];
    tags: string[];
  }>;
  error?: string;
}

interface TwoStagePipelineResult {
  success: boolean;
  transcription?: any;
  notion_project?: any;
  prd?: any;
  tasks?: any;
  step?: string;
  error?: string;
}

class AIService {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = process.env.RUNPOD_AI_URL || 'http://localhost:8000';
    this.timeout = parseInt(process.env.AI_TIMEOUT || '300000'); // 5분
  }

  /**
   * AI 서버 헬스 체크
   */
  async healthCheck(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ AI server health check failed:', error);
      throw error;
    }
  }

  /**
   * 음성 파일 전사
   */
  async transcribeAudio(audioBuffer: Buffer, filename?: string): Promise<TranscriptionResult> {
    try {
      console.log(`🎤 Transcribing audio: ${filename || 'unknown'} (${audioBuffer.length} bytes)`);

      const formData = new FormData();
      formData.append('audio', audioBuffer, {
        filename: filename || 'audio.wav',
        contentType: 'audio/wav'
      });

      const response = await fetch(`${this.baseUrl}/transcribe`, {
        method: 'POST',
        body: formData,
        timeout: this.timeout,
        headers: formData.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.status} ${response.statusText}`);
      }

      const result: TranscriptionResult = await response.json();
      
      if (result.success) {
        console.log(`✅ Transcription completed: ${result.transcription?.full_text?.length || 0} characters`);
      } else {
        console.error(`❌ Transcription failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error('❌ Transcription error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 회의 내용 분석
   */
  async analyzeMeeting(transcript: string): Promise<AnalysisResult> {
    try {
      console.log(`🧠 Analyzing meeting: ${transcript.length} characters`);

      const response = await fetch(`${this.baseUrl}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ transcript }),
        timeout: this.timeout
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status} ${response.statusText}`);
      }

      const result: AnalysisResult = await response.json();
      
      if (result.success) {
        console.log(`✅ Analysis completed`);
      } else {
        console.error(`❌ Analysis failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error('❌ Analysis error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 전체 파이프라인: 음성 → 전사 → 분석
   */
  async processFullPipeline(audioBuffer: Buffer, filename?: string): Promise<PipelineResult> {
    try {
      console.log(`🚀 Starting full pipeline: ${filename || 'unknown'}`);

      const formData = new FormData();
      formData.append('audio', audioBuffer, {
        filename: filename || 'audio.wav',
        contentType: 'audio/wav'
      });

      const response = await fetch(`${this.baseUrl}/pipeline`, {
        method: 'POST',
        body: formData,
        timeout: this.timeout,
        headers: formData.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Pipeline failed: ${response.status} ${response.statusText}`);
      }

      const result: PipelineResult = await response.json();
      
      if (result.success) {
        console.log(`✅ Pipeline completed successfully`);
      } else {
        console.error(`❌ Pipeline failed at ${result.step}: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error('❌ Pipeline error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 회의 내용을 노션 프로젝트 문서로 변환
   */
  async generateNotionProject(transcript: string): Promise<NotionProjectResult> {
    try {
      console.log(`📋 Generating Notion project: ${transcript.length} characters`);

      const response = await fetch(`${this.baseUrl}/generate-notion-project`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ transcript }),
        timeout: this.timeout
      });

      if (!response.ok) {
        throw new Error(`Notion project generation failed: ${response.status} ${response.statusText}`);
      }

      const result: NotionProjectResult = await response.json();
      
      if (result.success) {
        console.log(`✅ Notion project generated successfully`);
      } else {
        console.error(`❌ Notion project generation failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error('❌ Notion project generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 노션 프로젝트 문서를 Task Master PRD 형식으로 변환
   */
  async generateTaskMasterPRD(notionProject: any): Promise<TaskMasterPRDResult> {
    try {
      console.log(`📝 Generating Task Master PRD`);

      const response = await fetch(`${this.baseUrl}/generate-prd`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notion_project: notionProject }),
        timeout: this.timeout
      });

      if (!response.ok) {
        throw new Error(`PRD generation failed: ${response.status} ${response.statusText}`);
      }

      const result: TaskMasterPRDResult = await response.json();
      
      if (result.success) {
        console.log(`✅ Task Master PRD generated successfully`);
      } else {
        console.error(`❌ PRD generation failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error('❌ PRD generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Task Master PRD를 기반으로 세부 업무 생성
   */
  async generateTasks(prd: any): Promise<GeneratedTasksResult> {
    try {
      console.log(`⚡ Generating tasks from PRD`);

      const response = await fetch(`${this.baseUrl}/generate-tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prd }),
        timeout: this.timeout
      });

      if (!response.ok) {
        throw new Error(`Task generation failed: ${response.status} ${response.statusText}`);
      }

      const result: GeneratedTasksResult = await response.json();
      
      if (result.success) {
        console.log(`✅ Tasks generated successfully: ${result.tasks?.length || 0} tasks`);
      } else {
        console.error(`❌ Task generation failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error('❌ Task generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 2단계 전체 파이프라인: 음성 → 전사 → 노션 프로젝트 → PRD → 업무 생성
   */
  async processTwoStagePipeline(audioBuffer: Buffer, filename?: string): Promise<TwoStagePipelineResult> {
    try {
      console.log(`🚀 Starting 2-stage pipeline: ${filename || 'unknown'}`);

      const formData = new FormData();
      formData.append('audio', audioBuffer, {
        filename: filename || 'audio.wav',
        contentType: 'audio/wav'
      });

      const response = await fetch(`${this.baseUrl}/two-stage-pipeline`, {
        method: 'POST',
        body: formData,
        timeout: this.timeout * 2, // 2단계 처리로 더 긴 시간 필요
        headers: formData.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`2-stage pipeline failed: ${response.status} ${response.statusText}`);
      }

      const result: TwoStagePipelineResult = await response.json();
      
      if (result.success) {
        console.log(`✅ 2-stage pipeline completed successfully`);
      } else {
        console.error(`❌ 2-stage pipeline failed at ${result.step}: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error('❌ 2-stage pipeline error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * AI 서버 연결 테스트
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }
}

export { AIService };
export type { 
  TranscriptionResult, 
  AnalysisResult, 
  PipelineResult,
  NotionProjectResult,
  TaskMasterPRDResult,
  GeneratedTasksResult,
  TwoStagePipelineResult
};