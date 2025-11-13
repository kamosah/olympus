'use client';

import { useThreadsPanel } from '@/contexts/ThreadsPanelContext';
import { useStreamingQuery } from '@/hooks/useStreamingQuery';
import type { Thread } from '@/hooks/useThreads';
import type { Citation } from '@/lib/api/queries-client';
import { queryKeys } from '@/lib/query/client';
import { useAuthStore } from '@/lib/stores';
import { ScrollArea } from '@olympus/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ThreadsEmptyState } from '../threads/ThreadsEmptyState';
import { CitationList } from './CitationList';
import { ThreadInput } from './ThreadInput';
import { ThreadMessage } from './ThreadMessage';
import { ThreadResponse } from './ThreadResponse';

interface ThreadInterfaceProps {
  onMessageSubmit?: () => void;
  onThreadCreated?: (threadId: string) => void;
  initialThread?: Thread;
  spaceId?: string;
}

/**
 * ThreadInterface is the main chat component for the threads system.
 *
 * Features:
 * - Chat-style conversation display (Hex-inspired design)
 * - Real-time streaming responses
 * - Citation display with source links
 * - Thread input with keyboard shortcuts
 * - Clean, constrained-width interface
 * - Supports both org-wide and space-scoped threads
 * - Uses Zustand auth store for organization context
 * - Can load initial thread data for existing conversations
 * - Navigates to new thread page after first message
 *
 * @example
 * // New org-wide conversation (uses currentOrganization from Zustand)
 * <ThreadInterface />
 *
 * // Space-scoped conversation
 * <ThreadInterface spaceId="space-uuid" />
 *
 * // Load existing thread
 * <ThreadInterface initialThread={threadData} />
 */
export function ThreadInterface({
  onMessageSubmit,
  onThreadCreated,
  initialThread,
  spaceId,
}: ThreadInterfaceProps) {
  const { currentOrganization } = useAuthStore();
  const { minimize } = useThreadsPanel();
  const queryClient = useQueryClient();
  const [currentMessage, setCurrentMessage] = useState('');
  const [conversationHistory, setConversationHistory] = useState<
    Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: Date;
      citations?: Citation[];
      confidenceScore?: number;
    }>
  >(() => {
    // Initialize conversation history from initialThread if provided
    if (initialThread) {
      return [
        {
          role: 'user',
          content: initialThread.queryText,
          timestamp: new Date(initialThread.createdAt),
        },
        ...(initialThread.result
          ? [
              {
                role: 'assistant' as const,
                content: initialThread.result,
                timestamp: new Date(initialThread.updatedAt),
                citations: initialThread.sources || [],
                confidenceScore: initialThread.confidenceScore || undefined,
              },
            ]
          : []),
      ];
    }
    return [];
  });

  const {
    response,
    citations,
    confidenceScore,
    isStreaming,
    error,
    errorCode,
    retryCount,
    threadId,
    startStreaming,
    retry,
  } = useStreamingQuery();

  // Track which threadId we've added to conversation history to prevent duplicates
  const addedThreadId = useRef<string | null>(null);

  // Track which threadId we've cached to prevent duplicate cache updates
  const cachedThreadId = useRef<string | null>(null);

  // Auto-minimize ThreadsPanel when streaming starts on first message
  useEffect(() => {
    // Only minimize if this is the first message (new conversation)
    const isFirstMessage = conversationHistory.length === 1;
    if (isStreaming && isFirstMessage) {
      minimize();
    }
  }, [isStreaming, conversationHistory.length, minimize]);

  // Populate cache with thread data when streaming completes
  // This prevents loading state when navigating to individual thread page
  useEffect(() => {
    if (
      !isStreaming &&
      threadId &&
      currentMessage &&
      response &&
      cachedThreadId.current !== threadId
    ) {
      // Build thread data that matches GraphQL query shape
      const threadData = {
        query: {
          id: threadId,
          queryText: currentMessage,
          result: response,
          confidenceScore: confidenceScore || null,
          sources: citations, // Include citations so they persist
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      // Populate cache so individual thread page loads instantly
      queryClient.setQueryData(queryKeys.threads.detail(threadId), threadData);

      // Mark this threadId as cached to prevent duplicates
      cachedThreadId.current = threadId;
    }
  }, [
    isStreaming,
    threadId,
    currentMessage,
    response,
    confidenceScore,
    citations,
    queryClient,
  ]);

  // Navigate to new thread when threadId becomes available
  useEffect(() => {
    // If we have a threadId and no initialThread, this is a new conversation
    // Navigate to the individual thread page
    if (threadId && !initialThread && onThreadCreated) {
      onThreadCreated(threadId);
    }
  }, [threadId, initialThread, onThreadCreated]);

  // Add assistant response to conversation when streaming completes
  useEffect(() => {
    // When streaming completes and we have a response, add it to conversation history
    // Only add if:
    // 1. Streaming is complete (!isStreaming)
    // 2. We have a response
    // 3. We have a threadId (streaming completed successfully)
    // 4. We haven't already added this threadId to history
    // 5. The last message is from the user (we haven't added assistant response yet)
    if (
      !isStreaming &&
      response &&
      threadId &&
      addedThreadId.current !== threadId &&
      conversationHistory.length > 0 &&
      conversationHistory[conversationHistory.length - 1].role === 'user'
    ) {
      setConversationHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response,
          timestamp: new Date(),
          citations,
          confidenceScore: confidenceScore || undefined,
        },
      ]);
      // Mark this threadId as added to prevent duplicates
      addedThreadId.current = threadId;
    }
  }, [
    isStreaming,
    response,
    threadId,
    conversationHistory,
    citations,
    confidenceScore,
  ]);

  // Handle new message submission
  const handleSubmitMessage = async (message: string) => {
    setCurrentMessage(message);

    // Notify parent that a message was submitted
    onMessageSubmit?.();

    // Add user message to conversation
    setConversationHistory((prev) => [
      ...prev,
      {
        role: 'user',
        content: message,
        timestamp: new Date(),
      },
    ]);

    try {
      // Start streaming response
      await startStreaming({
        query: message,
        organizationId: currentOrganization?.id,
        spaceId,
        saveToDb: true, // Save to database for history
      });
      // Note: Assistant response will be added by useEffect when streaming completes
    } catch (err) {
      console.error('Message streaming failed:', err);
    }
  };

  // Handle retry on error - use the retry method from useStreamingQuery
  const handleRetry = async () => {
    try {
      await retry();
      // Note: Assistant response will be added by useEffect when streaming completes
    } catch (err) {
      console.error('Retry failed:', err);
    }
  };

  // Determine if we should show the active streaming response
  // Show it while streaming OR after completion but before adding to history
  const lastMessageIsFromUser =
    conversationHistory.length > 0 &&
    conversationHistory[conversationHistory.length - 1].role === 'user';
  const shouldShowActiveResponse =
    isStreaming || (response && lastMessageIsFromUser && !error);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Messages Container - Constrained width matching input */}
      <ScrollArea className="flex-1 p-0">
        {/* Conversation History - Constrained width container */}
        {conversationHistory.length > 0 && (
          <div className="max-w-3xl mx-auto">
            {conversationHistory.map((message, index) => (
              <div key={index}>
                <ThreadMessage
                  role={message.role}
                  content={message.content}
                  timestamp={message.timestamp}
                  confidenceScore={message.confidenceScore}
                />
                {/* Show citations for assistant messages */}
                {message.role === 'assistant' &&
                  message.citations &&
                  message.citations.length > 0 && (
                    <div className="px-4 pb-4">
                      <CitationList citations={message.citations} />
                    </div>
                  )}
              </div>
            ))}

            {/* Active Streaming Response - Only show while actively streaming or completed but not yet in history */}
            {shouldShowActiveResponse && (
              <ThreadResponse
                response={response}
                citations={citations}
                isStreaming={isStreaming}
                error={error}
                errorCode={errorCode}
                retryCount={retryCount}
                confidenceScore={confidenceScore}
                onRetry={handleRetry}
              />
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input Area - Empty state sits naturally above input */}
      <div className="flex-shrink-0 bg-white">
        {/* Empty State - Shows above input when no messages */}
        {conversationHistory.length === 0 && !isStreaming && (
          <div className="flex items-center justify-center py-12">
            <ThreadsEmptyState />
          </div>
        )}

        {/* Thread Input (Fixed at Bottom) - Same width as messages */}
        <ThreadInput onSubmit={handleSubmitMessage} isStreaming={isStreaming} />
      </div>
    </div>
  );
}
