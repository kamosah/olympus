import type { Citation } from '@/lib/api/queries-client';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Active streaming session state.
 * Persists across navigation to enable seamless transitions.
 */
export interface StreamingSession {
  threadId: string;
  query: string;
  response: string;
  citations: Citation[];
  confidenceScore: number | null;
  isStreaming: boolean;
  error: string | null;
  errorCode?: string;
  retryCount: number;
  startedAt: number; // timestamp for cleanup
  organizationId?: string;
  spaceId?: string;
}

interface StreamingState {
  // Active streaming sessions by threadId
  sessions: Record<string, StreamingSession>;

  // Actions
  createSession: (
    threadId: string,
    query: string,
    organizationId?: string,
    spaceId?: string
  ) => void;
  updateSession: (
    threadId: string,
    updates: Partial<Omit<StreamingSession, 'threadId' | 'startedAt'>>
  ) => void;
  completeSession: (threadId: string) => void;
  clearSession: (threadId: string) => void;
  getSession: (threadId: string) => StreamingSession | null;
  cleanupOldSessions: () => void; // Remove sessions older than 1 hour
}

const MAX_SESSION_AGE_MS = 60 * 60 * 1000; // 1 hour

/**
 * Streaming store - persists active streaming sessions across navigation.
 *
 * This enables:
 * - Immediate navigation to /threads/[threadId] when streaming starts
 * - Continuing to show streaming UI after navigation
 * - Recovery when user refreshes during streaming
 * - Cleanup of stale sessions
 *
 * Best practices from Claude, Grok, Hex:
 * - Navigate immediately when threadId is available (don't wait for completion)
 * - Persist streaming state across navigation
 * - Show streaming UI on the thread page if stream is active
 * - Handle refresh gracefully (reconnect or show completed state)
 */
export const useStreamingStore = create<StreamingState>()(
  devtools(
    (set, get) => ({
      sessions: {},

      createSession: (threadId, query, organizationId, spaceId) => {
        set((state) => ({
          sessions: {
            ...state.sessions,
            [threadId]: {
              threadId,
              query,
              response: '',
              citations: [],
              confidenceScore: null,
              isStreaming: true,
              error: null,
              retryCount: 0,
              startedAt: Date.now(),
              organizationId,
              spaceId,
            },
          },
        }));
      },

      updateSession: (threadId, updates) => {
        set((state) => {
          const session = state.sessions[threadId];
          if (!session) return state;

          return {
            sessions: {
              ...state.sessions,
              [threadId]: {
                ...session,
                ...updates,
              },
            },
          };
        });
      },

      completeSession: (threadId) => {
        set((state) => {
          const session = state.sessions[threadId];
          if (!session) return state;

          return {
            sessions: {
              ...state.sessions,
              [threadId]: {
                ...session,
                isStreaming: false,
              },
            },
          };
        });
      },

      clearSession: (threadId) => {
        set((state) => {
          const { [threadId]: _, ...remainingSessions } = state.sessions;
          return { sessions: remainingSessions };
        });
      },

      getSession: (threadId) => {
        return get().sessions[threadId] || null;
      },

      cleanupOldSessions: () => {
        const now = Date.now();
        set((state) => {
          const activeSessions = Object.fromEntries(
            Object.entries(state.sessions).filter(
              ([_, session]) => now - session.startedAt < MAX_SESSION_AGE_MS
            )
          );
          return { sessions: activeSessions };
        });
      },
    }),
    {
      name: 'streaming-store',
    }
  )
);
