import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import RightSidebar from './RightSidebar';

const Layout = () => {
  const [activeMenu, setActiveMenu] = useState('home');
  const location = useLocation();
  
  // Home 페이지에서만 RightSidebar 표시
  const showRightSidebar = location.pathname === '/';

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      {showRightSidebar && <RightSidebar />}
    </div>
  );
};

export default Layout; 