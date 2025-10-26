"use client";

import { useTRPC } from "@/trpc/client";

interface ApprovalsTestProps {
  projectId: string;
}

export function ApprovalsTest({ projectId }: ApprovalsTestProps) {
  const trpc = useTRPC();

  // Simple test to see if the router is accessible
  const { data, isLoading, error } = trpc.approvals.getPendingApprovals.useQuery(
    { projectId }
  );

  if (isLoading) {
    return <div>Loading approvals...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div>
      <h3>Approvals Test</h3>
      <p>Data: {JSON.stringify(data)}</p>
    </div>
  );
}