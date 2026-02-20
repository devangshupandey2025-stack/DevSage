import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './sidebar';
import { TopBar } from './topbar';

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="grid-pattern absolute inset-0" />
        <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-[#CCFF00]/[0.03] blur-[200px]" />
        <div className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full bg-[#CCFF00]/[0.02] blur-[180px]" />
      </div>

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />

      <div
        className="relative z-10 flex flex-col min-h-screen transition-all duration-300"
        style={{
          marginLeft: sidebarCollapsed ? 72 : 240,
        }}
      >
        <TopBar sidebarCollapsed={false} />
        <main className="flex-1 p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
