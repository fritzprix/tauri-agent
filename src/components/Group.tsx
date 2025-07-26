import { useCallback, useEffect, useState } from "react";
import { useSessionContext } from "../context/SessionContext";
import { dbService } from "../lib/db";
import { Session } from "../types/chat";

export default function Group() {
  const [groups, setGroups] = useState<Session[]>([]);
  const { select: selectSession } = useSessionContext();

  useEffect(() => {
    const fetchGroups = async () => {
      const fetchedSessions = await dbService.sessions.getPage(1, -1); // Fetch all sessions
      // Filter for sessions of type 'group'
      const groupSessions = fetchedSessions.items.filter(
        (session) => session.type === "group",
      );
      setGroups(groupSessions);
    };
    fetchGroups();
  }, []);

  const handleLoadGroupSession = useCallback(
    async (sessionId: string) => {
      await selectSession(sessionId);
    },
    [selectSession],
  );

  return (
    <div className="flex-1 flex flex-col p-4 bg-black text-green-400 font-mono rounded-lg overflow-hidden shadow-2xl shadow-green-400/30">
      <h2 className="text-2xl font-bold mb-6">Your Groups</h2>
      {groups.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <p>No groups created yet. Create a new group from the sidebar!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto terminal-scrollbar">
          {groups.map((group) => (
            <div
              key={group.id}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 cursor-pointer hover:border-green-400 transition-colors"
              onClick={() => handleLoadGroupSession(group.id)}
            >
              <h3 className="text-lg font-semibold text-green-300">
                {group.name || "Untitled Group"}
              </h3>
              <p className="text-sm text-gray-400 mt-2 line-clamp-3">
                {group.description || "No description provided."}
              </p>
              <div className="mt-3 text-xs text-gray-500">
                Assistants: {group.assistants.map((a) => a.name).join(", ")}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Created: {new Date(group.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
