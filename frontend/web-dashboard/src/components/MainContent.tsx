import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  Target, 
  Bell,
  Volume2,
  VolumeX,
  FileText,
  Settings,
  LayoutDashboard,
  List
} from 'lucide-react';
import KanbanBoard from './KanbanBoard';

const MainContent = () => {
  const [viewMode, setViewMode] = useState<'dashboard' | 'kanban'>('dashboard');

  return (
    <div className="flex-1 p-6 bg-gray-100 min-h-screen">
      {/* 헤더 및 뷰 모드 전환 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-lg shadow p-6 mb-6"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">오늘 회의 현황</h2>
          <div className="flex space-x-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setViewMode('dashboard')}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'dashboard' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              대시보드
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setViewMode('kanban')}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'kanban' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <List className="w-4 h-4 mr-2" />
              칸반보드
            </motion.button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="text-center"
          >
            <div className="text-2xl font-bold text-blue-600">12건</div>
            <div className="text-sm text-gray-600">총 회의 건수</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="text-center"
          >
            <div className="text-2xl font-bold text-blue-600">20초</div>
            <div className="text-sm text-gray-600">평균 요약 시간</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="text-center"
          >
            <div className="text-2xl font-bold text-blue-600">95%</div>
            <div className="text-sm text-gray-600">정확도</div>
          </motion.div>
        </div>
      </motion.div>

      {/* 뷰 모드에 따른 콘텐츠 */}
      {viewMode === 'kanban' ? (
        <KanbanBoard />
      ) : (
        <div className="grid grid-cols-4 gap-6">
        {/* 메인 콘텐츠 영역 */}
        <div className="col-span-3 space-y-6">
          {/* 완료, 진행중, 예약된 일 */}
          <div className="grid grid-cols-3 gap-6">
            {/* 완료 */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              whileHover={{ y: -5, shadow: "0 10px 25px rgba(0,0,0,0.1)" }}
              className="bg-white rounded-lg shadow p-4 transition-shadow duration-200"
            >
              <h3 className="font-semibold text-gray-700 mb-3">완료</h3>
              <div className="space-y-2">
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center text-sm"
                >
                  <Calendar className="w-4 h-4 mr-2 text-green-500" />
                  <span>WBS 문서 정리</span>
                  <span className="ml-auto text-gray-500">07.04</span>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center text-sm"
                >
                  <Calendar className="w-4 h-4 mr-2 text-green-500" />
                  <span>고구려정 지시사항(초안)</span>
                  <span className="ml-auto text-gray-500">07.04</span>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  className="flex items-center text-sm"
                >
                  <Calendar className="w-4 h-4 mr-2 text-green-500" />
                  <span>고구려정 업무시</span>
                  <span className="ml-auto text-gray-500">07.11</span>
                </motion.div>
              </div>
            </motion.div>

            {/* 진행중 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              whileHover={{ y: -5, shadow: "0 10px 25px rgba(0,0,0,0.1)" }}
              className="bg-white rounded-lg shadow p-4 transition-shadow duration-200"
            >
              <h3 className="font-semibold text-gray-700 mb-3">진행중</h3>
              <div className="space-y-2">
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center text-sm"
                >
                  <Clock className="w-4 h-4 mr-2 text-blue-500" />
                  <span>프로젝트 기획서</span>
                  <span className="ml-auto text-gray-500">07.04</span>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  className="flex items-center text-sm"
                >
                  <Clock className="w-4 h-4 mr-2 text-blue-500" />
                  <span>주간 데이터</span>
                  <span className="ml-auto text-gray-500">07.11</span>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                  className="flex items-center text-sm"
                >
                  <Clock className="w-4 h-4 mr-2 text-blue-500" />
                  <span>데이터베이스 설계서</span>
                  <span className="ml-auto text-gray-500">07.11</span>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 }}
                  className="flex items-center text-sm"
                >
                  <Clock className="w-4 h-4 mr-2 text-blue-500" />
                  <span>데이터 주차 프로그램</span>
                  <span className="ml-auto text-gray-500">07.11</span>
                </motion.div>
              </div>
            </motion.div>

            {/* 예약된 일 */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              whileHover={{ y: -5, shadow: "0 10px 25px rgba(0,0,0,0.1)" }}
              className="bg-white rounded-lg shadow p-4 transition-shadow duration-200"
            >
              <h3 className="font-semibold text-gray-700 mb-3">예약된 일</h3>
              <div className="space-y-2">
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  className="flex items-center text-sm"
                >
                  <Target className="w-4 h-4 mr-2 text-orange-500" />
                  <span>인증서를 데이터 전문가 교육</span>
                  <span className="ml-auto text-gray-500">07.18</span>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                  className="flex items-center text-sm"
                >
                  <Target className="w-4 h-4 mr-2 text-orange-500" />
                  <span>인증서를 학습 교육</span>
                  <span className="ml-auto text-gray-500">07.18</span>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 }}
                  className="flex items-center text-sm"
                >
                  <Target className="w-4 h-4 mr-2 text-orange-500" />
                  <span>학습한 인증서는 전문</span>
                  <span className="ml-auto text-gray-500">07.18</span>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.0 }}
                  className="flex items-center text-sm"
                >
                  <Target className="w-4 h-4 mr-2 text-orange-500" />
                  <span>주말 데이터 및 설치지 요청</span>
                  <span className="ml-auto text-gray-500">07.18</span>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.1 }}
                  className="flex items-center text-sm"
                >
                  <Target className="w-4 h-4 mr-2 text-orange-500" />
                  <span>시스템 아키텍처</span>
                  <span className="ml-auto text-gray-500">07.18</span>
                </motion.div>
              </div>
            </motion.div>
          </div>

          {/* 업무 테이블 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="bg-white rounded-lg shadow overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      담당자
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      진행중인 업무
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      마감일
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <motion.tr
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.0 }}
                    whileHover={{ backgroundColor: "#f9fafb" }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">노현구</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">백엔드</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        진행중
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">2025.07.15</td>
                  </motion.tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        {/* 오른쪽 사이드바 */}
        <div className="space-y-6">
          {/* 바로가기 */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="bg-white rounded-lg shadow p-4"
          >
            <h3 className="font-semibold text-gray-700 mb-3">바로가기</h3>
            <div className="grid grid-cols-2 gap-2">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Volume2 className="w-6 h-6 text-blue-500 mb-1" />
                <span className="text-xs text-gray-600">음성 메모 녹음</span>
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <VolumeX className="w-6 h-6 text-blue-500 mb-1" />
                <span className="text-xs text-gray-600">음성 재생</span>
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <FileText className="w-6 h-6 text-blue-500 mb-1" />
                <span className="text-xs text-gray-600">문서 분석</span>
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Settings className="w-6 h-6 text-blue-500 mb-1" />
                <span className="text-xs text-gray-600">내 업무 설정</span>
              </motion.button>
            </div>
          </motion.div>

          {/* 중요 알림 */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="bg-white rounded-lg shadow p-4"
          >
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center">
              <Bell className="w-5 h-5 mr-2 text-yellow-500" />
              중요 알림
            </h3>
            <div className="space-y-2">
              <motion.div 
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 }}
                className="text-sm text-gray-600"
              >
                - 마감 임박한 업무
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0 }}
                className="text-sm text-gray-600"
              >
                - 미확인 중요한 메시지
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.1 }}
                className="text-sm text-gray-600"
              >
                - 시스템 공지
              </motion.div>
            </div>
          </motion.div>

          {/* 최근 요약 & 업무 */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            className="bg-white rounded-lg shadow p-4"
          >
            <h3 className="font-semibold text-gray-700 mb-3">최근 요약 & 업무</h3>
            <div className="space-y-3">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
                className="text-sm"
              >
                <div className="font-medium">AI 모델 리뷰 (07.11)</div>
                <div className="text-gray-600">→ 새 업무 2건 생성</div>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="text-sm"
              >
                <div className="font-medium">UI/UX 개선 회의 (07.10)</div>
                <div className="text-gray-600">→ 새 업무 1건 생성</div>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                className="text-sm"
              >
                <div className="font-medium">------- [상세 보기] -------</div>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.3 }}
                whileHover={{ scale: 1.02 }}
                className="text-xs text-blue-600 cursor-pointer hover:underline"
              >
                + 새 업무 추가
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
      )}
    </div>
  );
};

export default MainContent;