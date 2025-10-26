"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Clock, CheckCircle, XCircle } from "lucide-react";

import { useTRPC } from "@/trpc/client";
import { ApprovalCard } from "./approval-card";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface ApprovalsSectionProps {
  projectId: string;
}

export function ApprovalsSection({ projectId }: ApprovalsSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  // Query for pending approvals
  const { data: pendingApprovals, isLoading: loadingPending } = trpc.approvals.getPendingApprovals.useQuery(
    { projectId },
    { refetchInterval: 5000 } // Check for new approvals every 5 seconds
  );

  // Query for all approvals (when viewing history)
  const { data: allApprovals, isLoading: loadingAll } = trpc.approvals.getAllApprovals.useQuery(
    { projectId },
    { enabled: showAll }
  );

  // Query for error stats
  const { data: errorStats } = trpc.approvals.getErrorStats.useQuery({ projectId });

  // Mutations for approve/reject
  const approveMutation = trpc.approvals.approveFix.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Fix approved and applied successfully!");
      } else {
        toast.error(`Fix approved but failed to apply: ${data.executionError}`);
      }
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (error) => {
      toast.error("Failed to approve fix");
      console.error(error);
    },
  });

  const rejectMutation = trpc.approvals.rejectFix.useMutation({
    onSuccess: () => {
      toast.success("Fix rejected");
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (error) => {
      toast.error("Failed to reject fix");
      console.error(error);
    },
  });

  const handleApprove = async (proposedFixId: string, feedback?: string) => {
    await approveMutation.mutateAsync({ proposedFixId, feedback });
  };

  const handleReject = async (proposedFixId: string, feedback: string) => {
    await rejectMutation.mutateAsync({ proposedFixId, feedback });
  };

  const pendingCount = pendingApprovals?.length || 0;
  const isLoading = approveMutation.isPending || rejectMutation.isPending;

  if (pendingCount === 0 && !showAll) {
    return null; // Don't show section if no pending approvals
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Fix Approvals
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {pendingCount} pending
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Review and approve AI-suggested fixes for errors
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowAll(!showAll)}
              size="sm"
            >
              {showAll ? "Show Pending Only" : "Show All History"}
            </Button>
          </div>
        </CardHeader>
        
        {errorStats && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span>
                  {errorStats.fixesByStatus.find(s => s.status === "PENDING")?._count.id || 0} Pending
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>
                  {errorStats.fixesByStatus.find(s => s.status === "APPROVED")?._count.id || 0} Approved
                </span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span>
                  {errorStats.fixesByStatus.find(s => s.status === "REJECTED")?._count.id || 0} Rejected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-purple-500" />
                <span>
                  {errorStats.fixesByStatus.find(s => s.status === "AUTO_FIXED")?._count.id || 0} Auto-fixed
                </span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Approvals list */}
      <Tabs value={showAll ? "all" : "pending"} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending" onClick={() => setShowAll(false)}>
            Pending ({pendingCount})
          </TabsTrigger>
          <TabsTrigger value="all" onClick={() => setShowAll(true)}>
            All History
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending" className="mt-4">
          {loadingPending ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading pending approvals...</p>
            </div>
          ) : pendingApprovals?.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No pending approvals</h3>
                <p className="text-muted-foreground">
                  All errors are either resolved or don't require approval.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingApprovals?.map((approval) => (
                <ApprovalCard
                  key={approval.id}
                  proposedFix={approval}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  isLoading={isLoading}
                />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="all" className="mt-4">
          {loadingAll ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading approval history...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allApprovals?.map((approval) => (
                <ApprovalCard
                  key={approval.id}
                  proposedFix={approval}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  isLoading={isLoading}
                />
              ))}
              {allApprovals?.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No approval history</h3>
                    <p className="text-muted-foreground">
                      No errors have occurred that required approval yet.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}