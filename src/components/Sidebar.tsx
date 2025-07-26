import { useCallback, useMemo } from "react";
import { useSessionContext } from "../context/SessionContext";
import Button from "./ui/Button";

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSettings: () => void;
  onViewChange: (view: "chat" | "group" | "history") => void;
  currentView: "chat" | "group" | "history";
  onOpenGroupCreationModal: () => void; // New prop
}

export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  onOpenSettings,
  onViewChange,
  currentView,
  onOpenGroupCreationModal,
}: SidebarProps) {
  const {
    select,
    sessions: sessionPages,
    current: currentSession,
    delete: deleteSession,
  } = useSessionContext();

  const sessions = useMemo(
    () => (sessionPages ? sessionPages.flatMap((p) => p.items) : []),
    [sessionPages],
  );

  const handleLoadSession = useCallback(
    async (sessionId: string) => {
      select(sessionId);
      onViewChange("chat"); // Switch to chat view after loading session
    },
    [select, onViewChange],
  );

  const navButtonClass = (view: string) =>
    `w-full justify-start transition-colors duration-150 ${currentView === view ? "bg-green-900/20 text-green-400" : "text-gray-400 hover:bg-gray-700"}`;

  return (
    <aside
      className={`flex flex-col bg-gray-800 text-green-400 h-screen transition-all duration-300 ease-in-out ${isCollapsed ? "w-16" : "w-64"} border-r border-gray-700 shadow-lg`}
    >
      {/* Sidebar Header */}
      <div className="p-4 flex items-center justify-between flex-shrink-0">
        {!isCollapsed && <h2 className="text-lg font-bold">Navigation</h2>}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="transition-transform duration-300 ease-in-out transform hover:scale-110"
        >
          {isCollapsed ? ">" : "<"}
        </Button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Chat Section */}
        <div>
          {!isCollapsed && <h3 className="text-sm font-semibold mb-2">Chat</h3>}
          <ul className="space-y-2">
            <li>
              <Button
                variant="ghost"
                className={navButtonClass("chat")}
                onClick={() => {
                  select();
                  onViewChange("chat");
                }}
              >
                {isCollapsed ? "💬" : "New Chat"}
              </Button>
            </li>
            {/* Placeholder for recent chats */}
          </ul>
        </div>

        {/* Group Section */}
        <div>
          {!isCollapsed && (
            <h3 className="text-sm font-semibold mb-2">Group</h3>
          )}
          <ul className="space-y-2">
            <li>
              <Button
                variant="ghost"
                className={navButtonClass("group")}
                onClick={() => onViewChange("group")}
              >
                {isCollapsed ? "👥" : "Create Group"}
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                className={navButtonClass("group")}
                onClick={onOpenGroupCreationModal}
              >
                {isCollapsed ? "+" : "New Group"}
              </Button>
            </li>
            {/* Placeholder for existing groups */}
          </ul>
        </div>

        {/* History Section */}
        <div>
          {!isCollapsed && (
            <h3 className="text-sm font-semibold mb-2">History</h3>
          )}
          <ul className="space-y-2">
            <li>
              <Button
                variant="ghost"
                className={navButtonClass("history")}
                onClick={() => onViewChange("history")}
              >
                {isCollapsed ? "📚" : "View History"}
              </Button>
            </li>
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between group"
              >
                <Button
                  variant="ghost"
                  className={`flex-1 justify-start text-left transition-colors duration-150 ${currentView === "chat" && currentSession?.id === session.id ? "bg-green-900/20 text-green-400" : "text-gray-400 hover:bg-gray-700"}`}
                  onClick={() => handleLoadSession(session.id)}
                >
                  {isCollapsed ? (
                    session.type === "single" ? (
                      "💬"
                    ) : (
                      "👥"
                    )
                  ) : (
                    <span className="truncate">
                      {session.name ||
                        session.assistants[0]?.name ||
                        "Untitled Session"}
                    </span>
                  )}
                </Button>
                {!isCollapsed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={async (e) => {
                      e.stopPropagation(); // Prevent loading session when deleting
                      if (
                        window.confirm(
                          `Are you sure you want to delete session "${session.name || "Untitled Session"}"?`,
                        )
                      ) {
                        await deleteSession(session.id);
                      }
                    }}
                  >
                    &#x2715; {/* X icon */}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Settings Button */}
      <div className="p-4 flex-shrink-0 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={onOpenSettings}
        >
          {isCollapsed ? "⚙" : "Settings"}
        </Button>
      </div>
    </aside>
  );
}
