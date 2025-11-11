'use client';

import { useDocuments } from '@/hooks/useDocuments';
import { useSpaces } from '@/hooks/useSpaces';
import { useThreads } from '@/hooks/useThreads';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  DashboardStatCard,
  DashboardStatCardSkeleton,
} from '@/components/dashboard/DashboardStatCard';
import {
  RecentDocumentItem,
  RecentDocumentItemSkeleton,
} from '@/components/dashboard/RecentDocumentItem';
import {
  RecentThreadItem,
  RecentThreadItemSkeleton,
} from '@/components/dashboard/RecentThreadItem';
import { FileText, MessageSquare, Database, Zap } from 'lucide-react';
import { useMemo } from 'react';
import { startOfMonth } from 'date-fns';

export default function DashboardPage() {
  const { currentOrganization } = useAuthStore();

  // Fetch data
  const {
    documents,
    total: totalDocuments,
    isLoading: isLoadingDocuments,
  } = useDocuments();
  const { spaces, isLoading: isLoadingSpaces } = useSpaces();
  const { threads, isLoading: isLoadingThreads } = useThreads({
    organizationId: currentOrganization?.id,
  });

  // Calculate threads this month
  const threadsThisMonth = useMemo(() => {
    if (!threads) return 0;
    const startOfCurrentMonth = startOfMonth(new Date());
    return threads.filter((thread) => {
      const threadDate = new Date(thread.createdAt);
      return threadDate >= startOfCurrentMonth;
    }).length;
  }, [threads]);

  // Get recent documents (top 3)
  const recentDocuments = useMemo(() => {
    if (!documents) return [];
    return [...documents]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 3);
  }, [documents]);

  // Get recent threads (top 3)
  const recentThreads = useMemo(() => {
    if (!threads) return [];
    return [...threads]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 3);
  }, [threads]);

  const isLoading = isLoadingDocuments || isLoadingSpaces || isLoadingThreads;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">
            Welcome back! Here&apos;s what&apos;s happening with your data.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          <>
            <DashboardStatCardSkeleton />
            <DashboardStatCardSkeleton />
            <DashboardStatCardSkeleton />
            <DashboardStatCardSkeleton />
          </>
        ) : (
          <>
            <DashboardStatCard
              icon={FileText}
              label="Total Documents"
              value={totalDocuments}
              iconBgColor="bg-blue-100"
              iconColor="text-blue-600"
            />
            <DashboardStatCard
              icon={MessageSquare}
              label="Threads This Month"
              value={threadsThisMonth}
              iconBgColor="bg-green-100"
              iconColor="text-green-600"
            />
            <DashboardStatCard
              icon={Database}
              label="Active Spaces"
              value={spaces?.length || 0}
              iconBgColor="bg-yellow-100"
              iconColor="text-yellow-600"
            />
            <DashboardStatCard
              icon={Zap}
              label="Total Threads"
              value={threads?.length || 0}
              iconBgColor="bg-purple-100"
              iconColor="text-purple-600"
            />
          </>
        )}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Documents */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Documents
            </h2>
          </div>
          <div className="p-6">
            {isLoadingDocuments ? (
              <div className="space-y-4">
                <RecentDocumentItemSkeleton />
                <RecentDocumentItemSkeleton />
                <RecentDocumentItemSkeleton />
              </div>
            ) : recentDocuments.length > 0 ? (
              <div className="space-y-4">
                {recentDocuments.map((doc) => (
                  <RecentDocumentItem
                    key={doc.id}
                    name={doc.name}
                    createdAt={doc.createdAt}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">
                No documents yet. Upload your first document to get started.
              </p>
            )}
          </div>
        </div>

        {/* Recent Threads */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Threads
            </h2>
          </div>
          <div className="p-6">
            {isLoadingThreads ? (
              <div className="space-y-4">
                <RecentThreadItemSkeleton />
                <RecentThreadItemSkeleton />
                <RecentThreadItemSkeleton />
              </div>
            ) : recentThreads.length > 0 ? (
              <div className="space-y-4">
                {recentThreads.map((thread) => (
                  <RecentThreadItem
                    key={thread.id}
                    queryText={thread.queryText}
                    createdAt={thread.createdAt}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">
                No threads yet. Start a conversation to analyze your data.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
