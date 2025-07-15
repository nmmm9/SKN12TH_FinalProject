import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, MessageSquare, FileText, Settings } from 'lucide-react';

interface SidebarProps {
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
}

const Sidebar = ({ activeMenu, setActiveMenu }: SidebarProps) => {
  const location = useLocation();
  
  const menuItems = [
    { id: 'home', icon: Home, label: 'Home', path: '/' },
    { id: 'meeting', icon: MessageSquare, label: '회의 분석', path: '/meeting' },
    { id: 'task', icon: FileText, label: '업무 관리', path: '/task' },
    { id: 'settings', icon: Settings, label: '설정', path: '/settings' },
  ];

  const getActiveMenu = () => {
    const currentPath = location.pathname;
    const currentItem = menuItems.find(item => item.path === currentPath);
    return currentItem?.id || 'home';
  };

  return (
    <div className="w-64 bg-blue-900 text-white min-h-screen">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white">TtalKkak</h1>
      </div>
      
      <nav className="mt-8">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = getActiveMenu() === item.id;
          return (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => setActiveMenu(item.id)}
              className={`w-full flex items-center px-6 py-3 text-left hover:bg-blue-800 transition-colors ${
                isActive ? 'bg-blue-800 border-r-2 border-white' : ''
              }`}
            >
              <Icon className="w-5 h-5 mr-3" />
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar; 