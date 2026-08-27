'use client'

import React, { useState } from 'react';
import { X } from 'lucide-react';
import ChatSidebar from './ChatSidebar';
import ChatArea from './ChatArea';

/**
 * Two columns only: conversation list and the chat itself.
 *
 * The old third column ("Action Center") held three cards that were hard-coded to their
 * empty state — they never read appointments, prescriptions or reports — so it cost a
 * third of the width to say "nothing here" three times. The surrounding glass/gradient
 * treatment went with it: a chat reads better on a plain surface.
 */
const AIAssistantLayout: React.FC = () => {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [refreshSidebarKey, setRefreshSidebarKey] = useState(0);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleNewChat = () => {
    setActiveConversationId(null);
    setMobileSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setMobileSidebarOpen(false);
  };

  const handleConversationCreated = (id: string) => {
    setActiveConversationId(id);
    setRefreshSidebarKey(prev => prev + 1);
  };

  return (
    // The root layout wraps every page in `mx-4 sm:mx-[10%]`, which caps this panel at
    // 80% of the viewport no matter how wide it is allowed to grow. Negative margins
    // cancel exactly that gutter so the assistant can use the full screen — a chat needs
    // the width far more than a marketing page does.
    <div className="bg-slate-50 sm:p-6 lg:p-8 flex justify-center font-sans -mx-4 sm:-mx-[11.111%]">

      {/* Mobile drawer + backdrop live outside the panel below: a `backdrop-filter` or
          `transform` ancestor becomes the containing block for `position: fixed`
          descendants, which would shrink these to the panel instead of the viewport. */}
      {mobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-slate-900/30 z-40"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <div
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[85%] max-w-[320px] bg-white border-r border-slate-200 shadow-xl transition-transform duration-200 ease-out ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-end px-3 pt-3">
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close conversations"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="h-[calc(100%-48px)]">
          <ChatSidebar
            activeId={activeConversationId}
            onSelect={handleSelectConversation}
            onNewChat={handleNewChat}
            refreshKey={refreshSidebarKey}
          />
        </div>
      </div>

      {/* Wider and taller than before: a medical conversation runs long, and the extra
          room means noticeably fewer messages scroll out of view mid-answer. */}
      <div className="w-full max-w-[1400px] h-dvh sm:h-[92vh] bg-white sm:rounded-2xl border border-slate-200 sm:shadow-sm overflow-hidden flex">

        {/* Conversation list */}
        <div className="hidden lg:flex w-70 shrink-0 border-r border-slate-200 flex-col bg-slate-50/60">
          <ChatSidebar
            activeId={activeConversationId}
            onSelect={handleSelectConversation}
            onNewChat={handleNewChat}
            refreshKey={refreshSidebarKey}
          />
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          <ChatArea
            activeId={activeConversationId}
            onConversationCreated={handleConversationCreated}
            onOpenSidebar={() => setMobileSidebarOpen(true)}
          />
        </div>

      </div>
    </div>
  );
};

export default AIAssistantLayout;
