'use client'

import React, { useState } from 'react';
import ChatSidebar from './ChatSidebar';
import ChatArea from './ChatArea';
import HealthInsightsSidebar from './HealthInsightsSidebar';

const AIAssistantLayout: React.FC = () => {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [refreshSidebarKey, setRefreshSidebarKey] = useState(0);

  const handleNewChat = () => {
    setActiveConversationId(null);
  };

  const handleConversationCreated = (id: string) => {
    setActiveConversationId(id);
    setRefreshSidebarKey(prev => prev + 1);
  };

  return (
    <div className="relative min-h-screen bg-blue-50 p-4 sm:p-6 lg:p-10 flex items-center justify-center font-sans overflow-hidden">
      
      {/* Home Page Consistent Background Pattern */}
      <div 
          className="absolute inset-0 z-0 opacity-40 bg-cover bg-center mix-blend-multiply"
          style={{ backgroundImage: "url('/assets/header_img.png')" }}
      ></div>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100/90 via-blue-50/70 to-teal-50/40 z-0"></div>
      
      {/* Background Decorative Blob */}
      <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-teal-400/20 rounded-full blur-3xl opacity-50 z-0 animate-pulse" style={{ animationDuration: '8s' }}></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[40rem] h-[40rem] bg-blue-500/20 rounded-full blur-3xl opacity-50 z-0 animate-pulse" style={{ animationDuration: '10s' }}></div>

      <div className="relative z-10 w-full max-w-[1500px] h-[92vh] bg-white/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/70 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col lg:flex-row transition-all hover:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)]">
        
        {/* Left Sidebar */}
        <div className="hidden lg:flex w-[320px] flex-shrink-0 bg-white/30 border-r border-white/60 flex-col">
          <ChatSidebar 
            activeId={activeConversationId} 
            onSelect={setActiveConversationId} 
            onNewChat={handleNewChat}
            refreshKey={refreshSidebarKey}
          />
        </div>

        {/* Center Chat Area */}
        <div className="flex-1 flex flex-col relative min-w-0 bg-transparent">
          <ChatArea 
            activeId={activeConversationId} 
            onConversationCreated={handleConversationCreated} 
          />
        </div>

        {/* Right Sidebar (Health Insights) */}
        <div className="hidden xl:flex w-[340px] flex-shrink-0 bg-white/30 border-l border-white/60 p-8 flex-col overflow-y-auto custom-scrollbar shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.05)]">
          <HealthInsightsSidebar />
        </div>

      </div>
    </div>
  );
};

export default AIAssistantLayout;
