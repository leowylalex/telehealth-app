"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Clock, AlertTriangle, Code, Terminal, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ProposedFix {
  id: string;
  description: string;
  reasoning: string;
  confidence: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "AUTO_FIXED";
  fixData: {
    type: "command" | "fileChange" | "multiStep";
    commands?: string[];
    files?: Array<{ path: string; content: string }>;
    steps?: string[];
  };
  errorLog: {
    category: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    diagnostic: string;
  };
  createdAt: string;
  reviewedAt?: string;
  feedback?: string;
}

interface ApprovalCardProps {
  proposedFix: ProposedFix;
  onApprove: (id: string, feedback?: string) => Promise<void>;
  onReject: (id: string, feedback: string) => Promise<void>;
  isLoading?: boolean;
}

const severityColors = {
  LOW: "bg-green-100 text-green-800",
  MEDIUM: "bg-yellow-100 text-yellow-800", 
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800"
};

const categoryIcons = {
  COMPILATION: Terminal,
  DEPENDENCY: Code,
  SYNTAX: FileText,
  LOGIC: AlertTriangle,
  INFRASTRUCTURE: AlertTriangle,
  USER_INPUT: FileText
};

const statusColors = {
  PENDING: "bg-blue-100 text-blue-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  AUTO_FIXED: "bg-purple-100 text-purple-800"
};

const statusIcons = {
  PENDING: Clock,
  APPROVED: CheckCircle,
  REJECTED: XCircle,
  AUTO_FIXED: CheckCircle
};

export function ApprovalCard({ proposedFix, onApprove, onReject, isLoading }: ApprovalCardProps) {
  const [feedback, setFeedback] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const CategoryIcon = categoryIcons[proposedFix.errorLog.category as keyof typeof categoryIcons];
  const StatusIcon = statusIcons[proposedFix.status];

  const confidenceColor = proposedFix.confidence > 0.8 
    ? "text-green-600" 
    : proposedFix.confidence > 0.6 
    ? "text-yellow-600" 
    : "text-red-600";

  const handleApprove = async () => {
    await onApprove(proposedFix.id, feedback || undefined);
    setFeedback("");
  };

  const handleReject = async () => {
    if (!feedback.trim()) {
      alert("Please provide feedback when rejecting a fix");
      return;
    }
    await onReject(proposedFix.id, feedback);
    setFeedback("");
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <CategoryIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">{proposedFix.description}</CardTitle>
              <CardDescription className="mt-1">
                {proposedFix.errorLog.diagnostic}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusColors[proposedFix.status]}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {proposedFix.status.replace('_', ' ')}
            </Badge>
            <Badge className={severityColors[proposedFix.errorLog.severity]}>
              {proposedFix.errorLog.severity}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Confidence and Category */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Category:</span>
              <Badge variant="outline">{proposedFix.errorLog.category}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Confidence:</span>
              <span className={`font-medium ${confidenceColor}`}>
                {Math.round(proposedFix.confidence * 100)}%
              </span>
            </div>
          </div>

          {/* Reasoning */}
          <div>
            <h4 className="font-medium text-sm mb-2">AI Reasoning:</h4>
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              {proposedFix.reasoning}
            </p>
          </div>

          {/* Fix Details */}
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                <span className="font-medium text-sm">Proposed Changes</span>
                <span className="text-xs text-muted-foreground">
                  {isExpanded ? "Hide" : "Show"} Details
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="bg-muted p-3 rounded-md">
                {proposedFix.fixData.type === "command" && (
                  <div>
                    <h5 className="font-medium text-sm mb-2">Commands to run:</h5>
                    <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
                      {proposedFix.fixData.commands?.join('\n')}
                    </pre>
                  </div>
                )}
                
                {proposedFix.fixData.type === "fileChange" && (
                  <div>
                    <h5 className="font-medium text-sm mb-2">Files to modify:</h5>
                    {proposedFix.fixData.files?.map((file, index) => (
                      <div key={index} className="mb-2">
                        <code className="text-xs font-medium">{file.path}</code>
                        <pre className="text-xs bg-background p-2 rounded mt-1 max-h-32 overflow-auto">
                          {file.content}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
                
                {proposedFix.fixData.type === "multiStep" && (
                  <div className="space-y-3">
                    {proposedFix.fixData.commands && (
                      <div>
                        <h5 className="font-medium text-sm mb-2">Commands:</h5>
                        <pre className="text-xs bg-background p-2 rounded">
                          {proposedFix.fixData.commands.join('\n')}
                        </pre>
                      </div>
                    )}
                    {proposedFix.fixData.files && (
                      <div>
                        <h5 className="font-medium text-sm mb-2">File changes:</h5>
                        {proposedFix.fixData.files.map((file, index) => (
                          <div key={index} className="mb-2">
                            <code className="text-xs font-medium">{file.path}</code>
                            <pre className="text-xs bg-background p-2 rounded mt-1 max-h-24 overflow-auto">
                              {file.content.slice(0, 200)}
                              {file.content.length > 200 && "..."}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Actions for pending fixes */}
          {proposedFix.status === "PENDING" && (
            <div className="space-y-3 pt-2 border-t">
              <Textarea
                placeholder="Optional feedback (required for rejection)..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="min-h-20"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleApprove}
                  disabled={isLoading}
                  className="flex-1"
                  variant="default"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve & Apply
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={isLoading || !feedback.trim()}
                  variant="destructive"
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            </div>
          )}

          {/* Feedback for processed fixes */}
          {proposedFix.status !== "PENDING" && proposedFix.feedback && (
            <div className="pt-2 border-t">
              <h4 className="font-medium text-sm mb-2">Review Feedback:</h4>
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                {proposedFix.feedback}
              </p>
              {proposedFix.reviewedAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  Reviewed on {new Date(proposedFix.reviewedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}