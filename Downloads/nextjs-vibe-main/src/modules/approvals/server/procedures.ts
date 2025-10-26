import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getSandbox } from "@/inngest/utils";

import { prisma } from "@/lib/db";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";

// Execute a proposed fix
async function executeProposedFix(proposedFix: any, sandboxId?: string) {
  try {
    const fixData = proposedFix.fixData;

    if (fixData.type === "command") {
      if (!sandboxId) {
        throw new Error("Sandbox ID required for command execution");
      }
      const sandbox = await getSandbox(sandboxId);
      
      for (const command of fixData.commands) {
        await sandbox.commands.run(command);
      }
    } else if (fixData.type === "fileChange") {
      if (!sandboxId) {
        throw new Error("Sandbox ID required for file changes");
      }
      const sandbox = await getSandbox(sandboxId);
      
      for (const file of fixData.files) {
        await sandbox.files.write(file.path, file.content);
      }
    } else if (fixData.type === "multiStep") {
      if (!sandboxId) {
        throw new Error("Sandbox ID required for multi-step fixes");
      }
      const sandbox = await getSandbox(sandboxId);
      
      // Execute commands first
      if (fixData.commands) {
        for (const command of fixData.commands) {
          await sandbox.commands.run(command);
        }
      }
      
      // Then update files
      if (fixData.files) {
        for (const file of fixData.files) {
          await sandbox.files.write(file.path, file.content);
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Fix execution failed:", error);
    return { success: false, error: error?.toString() };
  }
}

export const approvalsRouter = createTRPCRouter({
  // Get pending approvals for a project
  getPendingApprovals: protectedProcedure
    .input(z.object({
      projectId: z.string().min(1)
    }))
    .query(async ({ input, ctx }) => {
      const approvals = await prisma.proposedFix.findMany({
        where: {
          status: "PENDING",
          errorLog: {
            message: {
              projectId: input.projectId,
              project: {
                userId: ctx.auth.userId
              }
            }
          }
        },
        include: {
          errorLog: {
            include: {
              message: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      return approvals;
    }),

  // Get all approvals for a project (pending, approved, rejected)
  getAllApprovals: protectedProcedure
    .input(z.object({
      projectId: z.string().min(1)
    }))
    .query(async ({ input, ctx }) => {
      const approvals = await prisma.proposedFix.findMany({
        where: {
          errorLog: {
            message: {
              projectId: input.projectId,
              project: {
                userId: ctx.auth.userId
              }
            }
          }
        },
        include: {
          errorLog: {
            include: {
              message: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      return approvals;
    }),

  // Approve a proposed fix
  approveFix: protectedProcedure
    .input(z.object({
      proposedFixId: z.string().min(1),
      feedback: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      // Get the proposed fix with error log and message
      const proposedFix = await prisma.proposedFix.findUnique({
        where: { id: input.proposedFixId },
        include: {
          errorLog: {
            include: {
              message: {
                include: {
                  project: true,
                  fragment: true
                }
              }
            }
          }
        }
      });

      if (!proposedFix) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Proposed fix not found" });
      }

      // Check if user owns the project
      if (proposedFix.errorLog.message.project.userId !== ctx.auth.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
      }

      // Check if already processed
      if (proposedFix.status !== "PENDING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Fix already processed" });
      }

      // Execute the fix if there's a sandbox available
      let executionResult = { success: true };
      const fragment = proposedFix.errorLog.message.fragment;
      
      if (fragment?.sandboxUrl) {
        // Extract sandbox ID from URL if possible
        // This is a simplified approach - you might need to adjust based on your sandbox URL format
        const sandboxId = fragment.sandboxUrl.split('.')[0];
        executionResult = await executeProposedFix(proposedFix, sandboxId);
      }

      // Update the proposed fix status
      const updatedFix = await prisma.proposedFix.update({
        where: { id: input.proposedFixId },
        data: {
          status: executionResult.success ? "APPROVED" : "PENDING",
          reviewedBy: ctx.auth.userId,
          reviewedAt: new Date(),
          feedback: input.feedback || `Fix ${executionResult.success ? 'applied successfully' : 'failed to apply'}`
        }
      });

      // Create a message indicating the fix was applied or failed
      await prisma.message.create({
        data: {
          projectId: proposedFix.errorLog.message.projectId,
          content: executionResult.success 
            ? `✅ Fix applied: ${proposedFix.description}`
            : `❌ Fix failed: ${proposedFix.description}. Error: ${executionResult.error}`,
          role: "ASSISTANT",
          type: "RESULT"
        }
      });

      return { 
        success: executionResult.success, 
        proposedFix: updatedFix,
        executionError: executionResult.error
      };
    }),

  // Reject a proposed fix  
  rejectFix: protectedProcedure
    .input(z.object({
      proposedFixId: z.string().min(1),
      feedback: z.string().min(1)
    }))
    .mutation(async ({ input, ctx }) => {
      // Get the proposed fix
      const proposedFix = await prisma.proposedFix.findUnique({
        where: { id: input.proposedFixId },
        include: {
          errorLog: {
            include: {
              message: {
                include: {
                  project: true
                }
              }
            }
          }
        }
      });

      if (!proposedFix) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Proposed fix not found" });
      }

      // Check if user owns the project
      if (proposedFix.errorLog.message.project.userId !== ctx.auth.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
      }

      // Check if already processed
      if (proposedFix.status !== "PENDING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Fix already processed" });
      }

      // Update the proposed fix status
      const updatedFix = await prisma.proposedFix.update({
        where: { id: input.proposedFixId },
        data: {
          status: "REJECTED",
          reviewedBy: ctx.auth.userId,
          reviewedAt: new Date(),
          feedback: input.feedback
        }
      });

      // Create a message indicating the fix was rejected
      await prisma.message.create({
        data: {
          projectId: proposedFix.errorLog.message.projectId,
          content: `❌ Fix rejected: ${proposedFix.description}. Reason: ${input.feedback}`,
          role: "ASSISTANT",
          type: "RESULT"
        }
      });

      return updatedFix;
    }),

  // Get error statistics for a project
  getErrorStats: protectedProcedure
    .input(z.object({
      projectId: z.string().min(1)
    }))
    .query(async ({ input, ctx }) => {
      const stats = await prisma.errorLog.groupBy({
        by: ['category', 'severity'],
        where: {
          message: {
            projectId: input.projectId,
            project: {
              userId: ctx.auth.userId
            }
          }
        },
        _count: {
          id: true
        }
      });

      const proposedFixStats = await prisma.proposedFix.groupBy({
        by: ['status'],
        where: {
          errorLog: {
            message: {
              projectId: input.projectId,
              project: {
                userId: ctx.auth.userId
              }
            }
          }
        },
        _count: {
          id: true
        }
      });

      return {
        errorsByCategory: stats,
        fixesByStatus: proposedFixStats
      };
    })
});