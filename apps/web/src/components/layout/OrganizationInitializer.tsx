'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useOrganizations, type Organization } from '@/hooks/useOrganizations';

/**
 * Helper function to map Organization to auth store format
 */
function mapOrganizationToStoreFormat(org: Organization) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    description: org.description,
    ownerId: org.ownerId,
    memberCount: org.memberCount,
    spaceCount: org.spaceCount,
    threadCount: org.threadCount,
  };
}

/**
 * OrganizationInitializer - Ensures currentOrganization is set on app load.
 *
 * This component handles organization initialization independently of the UI:
 * - Zustand persist middleware restores currentOrganization from localStorage
 * - If no organization is persisted, auto-selects the first available one
 * - Runs on app mount, regardless of sidebar open/close state
 *
 * This prevents "organization_id required" errors when creating threads.
 */
export function OrganizationInitializer() {
  const { currentOrganization, setCurrentOrganization } = useAuthStore();
  const { organizations = [], isLoading } = useOrganizations();

  useEffect(() => {
    // Wait for organizations to load
    if (isLoading || organizations.length === 0) {
      return;
    }

    // If currentOrganization already exists (from localStorage), we're done
    if (currentOrganization) {
      return;
    }

    // No organization selected - auto-select first one
    const firstOrg = organizations[0];
    console.log(
      '[OrganizationInitializer] Auto-selecting first organization:',
      firstOrg.name
    );
    setCurrentOrganization(mapOrganizationToStoreFormat(firstOrg));
  }, [isLoading, organizations, currentOrganization, setCurrentOrganization]);

  // This component renders nothing - it's just for initialization logic
  return null;
}
