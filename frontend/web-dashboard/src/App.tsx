import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import MeetingAnalysis from './pages/MeetingAnalysis';
import TaskManagement from './pages/TaskManagement';
import Settings from './pages/Settings';
import { connectSocket, disconnectSocket } from './services/api';
import './App.css';

// React Query 클라이언트 설정
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5분
    },
    mutations: {
      retry: 1,
    },
  },
});

function App() {
  // 앱 시작 시 Socket 연결
  useEffect(() => {
    const socket = connectSocket();
    
    socket.on('connect', () => {
      console.log('✅ Socket.IO 연결됨');
    });
    
    socket.on('disconnect', () => {
      console.log('❌ Socket.IO 연결 해제됨');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.IO 연결 오류:', error);
    });

    // 클린업
    return () => {
      disconnectSocket();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App min-h-screen bg-neutral-50 font-sans antialiased">
          <Routes>
            {/* 랜딩 페이지 */}
            <Route path="/" element={<Landing />} />
            
            {/* 대시보드 및 관리 페이지들 */}
            <Route path="/dashboard" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="meeting" element={<MeetingAnalysis />} />
              <Route path="task" element={<TaskManagement />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
          
          {/* Toast 알림 */}
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'white',
                color: '#374151',
                border: '1px solid #E5E7EB',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '500',
              },
              classNames: {
                success: 'border-l-4 border-accent-green',
                error: 'border-l-4 border-accent-red',
              },
            }}
          />
          
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App; 