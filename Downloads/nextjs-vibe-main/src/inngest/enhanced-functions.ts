import { z } from "zod";
import { Sandbox } from "@e2b/code-interpreter";
import { openai, createAgent, createTool, createNetwork, type Tool, type Message, createState } from "@inngest/agent-kit";

import { prisma } from "@/lib/db";
import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT, ERROR_ANALYSIS_PROMPT, FIX_GENERATION_PROMPT } from "@/prompt";

import { inngest } from "./client";
import { SANDBOX_TIMEOUT } from "./types";
import { getSandbox, lastAssistantTextMessageContent, parseAgentOutput } from "./utils";

interface AgentState {
  summary: string;
  files: { [path: string]: string };
}

// Enhanced error analysis function
async function analyzeError(errorData: any) {
  const errorAnalysisAgent = createAgent({
    name: "error-analyzer",
    client: openai({
      model: "gpt-4o-mini",
      apiKey: process.env.OPENAI_API_KEY!,
    }),
    system: ERROR_ANALYSIS_PROMPT,
  });

  try {
    const result = await errorAnalysisAgent.run(JSON.stringify(errorData));
    return JSON.parse(result.output);
  } catch (e) {
    console.error("Error analysis failed:", e);
    return {
      category: "INFRASTRUCTURE",
      severity: "HIGH",
      diagnostic: "Failed to analyze error",
      canAutoFix: false,
      confidence: 0.0,
      suggestedActions: ["Manual review required"]
    };
  }
}

// Enhanced fix generation function
async function generateFix(errorAnalysis: any, errorData: any) {
  const fixGenerationAgent = createAgent({
    name: "fix-generator",
    client: openai({
      model: "gpt-4o-mini",
      apiKey: process.env.OPENAI_API_KEY!,
    }),
    system: FIX_GENERATION_PROMPT,
  });

  try {
    const context = {
      errorAnalysis,
      errorData,
      environment: "Next.js 15.3.3 with TypeScript"
    };
    
    const result = await fixGenerationAgent.run(JSON.stringify(context));
    return JSON.parse(result.output);
  } catch (e) {
    console.error("Fix generation failed:", e);
    return null;
  }
}

// Enhanced error handling function
async function handleError(error: any, context: any, projectId: string) {
  try {
    // Create error message first
    const errorMessage = await prisma.message.create({
      data: {
        projectId,
        content: `Error occurred: ${error.toString()}`,
        role: "ASSISTANT",
        type: "ERROR",
      },
    });

    // Analyze the error
    const errorAnalysis = await analyzeError({
      error: error.toString(),
      context,
      timestamp: new Date().toISOString()
    });

    // Create error log
    const errorLog = await prisma.errorLog.create({
      data: {
        messageId: errorMessage.id,
        category: errorAnalysis.category,
        severity: errorAnalysis.severity,
        errorData: {
          error: error.toString(),
          context,
          analysis: errorAnalysis
        },
        diagnostic: errorAnalysis.diagnostic,
      },
    });

    // Generate fix if error can be auto-fixed
    if (errorAnalysis.canAutoFix && errorAnalysis.confidence > 0.7) {
      const proposedFix = await generateFix(errorAnalysis, {
        error: error.toString(),
        context
      });

      if (proposedFix) {
        await prisma.proposedFix.create({
          data: {
            errorLogId: errorLog.id,
            description: proposedFix.description,
            fixData: proposedFix.fixData,
            reasoning: proposedFix.reasoning,
            confidence: proposedFix.confidence,
            status: errorAnalysis.severity === "LOW" && proposedFix.confidence > 0.8 
              ? "AUTO_FIXED" 
              : "PENDING",
          },
        });

        // If low severity and high confidence, auto-apply
        if (errorAnalysis.severity === "LOW" && proposedFix.confidence > 0.8) {
          // TODO: Implement auto-fix execution
          console.log("Auto-fixing error:", proposedFix.description);
        } else {
          // Create approval request message
          await prisma.message.create({
            data: {
              projectId,
              content: JSON.stringify({
                type: "approval_request",
                errorLogId: errorLog.id,
                description: proposedFix.description,
                reasoning: proposedFix.reasoning,
                confidence: proposedFix.confidence
              }),
              role: "ASSISTANT",
              type: "APPROVAL_REQUEST",
            },
          });
        }
      }
    }

    return errorMessage;
  } catch (e) {
    console.error("Error handling failed:", e);
    // Fallback to simple error message
    return await prisma.message.create({
      data: {
        projectId,
        content: "Something went wrong. Please try again.",
        role: "ASSISTANT",
        type: "ERROR",
      },
    });
  }
}

export const enhancedCodeAgentFunction = inngest.createFunction(
  { id: "enhanced-code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("vibe-nextjs-test-2");
      await sandbox.setTimeout(SANDBOX_TIMEOUT);
      return sandbox.sandboxId;
    });

    const previousMessages = await step.run("get-previous-messages", async () => {
      const formattedMessages: Message[] = [];

      const messages = await prisma.message.findMany({
        where: {
          projectId: event.data.projectId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      });

      for (const message of messages) {
        formattedMessages.push({
          type: "text",
          role: message.role === "ASSISTANT" ? "assistant" : "user",
          content: message.content,
        })
      }

      return formattedMessages.reverse();
    });

    const state = createState<AgentState>({
      summary: "",
      files: {},
    });

    const network = createNetwork([
      createAgent({
        name: "code-agent",
        client: openai({
          model: "gpt-4o",
          apiKey: process.env.OPENAI_API_KEY!,
        }),
        system: PROMPT,
        tools: [
          createTool({
            name: "terminal",
            description: "Execute a command in the terminal",
            parameters: z.object({
              command: z.string(),
            }),
            handler: async ({ command }) => {
              const buffers = { stdout: "", stderr: "" };

              try {
                const sandbox = await getSandbox(sandboxId);
                const result = await sandbox.commands.run(command, {
                  onStdout: (data: string) => {
                    buffers.stdout += data;
                  },
                  onStderr: (data: string) => {
                    buffers.stderr += data;
                  }
                });
                return result.stdout;
              } catch (e) {
                const errorContext = {
                  tool: "terminal",
                  command,
                  stdout: buffers.stdout,
                  stderr: buffers.stderr,
                  error: e?.toString()
                };
                
                throw new Error(JSON.stringify(errorContext));
              }
            },
          }),
          createTool({
            name: "createOrUpdateFiles",
            description: "Create or update files in the sandbox",
            parameters: z.object({
              files: z.array(
                z.object({
                  path: z.string(),
                  content: z.string(),
                }),
              ),
            }),
            handler: async (
              { files },
              { step, network }: Tool.Options<AgentState>
            ) => {
              const newFiles = await step?.run("createOrUpdateFiles", async () => {
                try {
                  const updatedFiles = network.state.data.files || {};
                  const sandbox = await getSandbox(sandboxId);
                  for (const file of files) {
                    await sandbox.files.write(file.path, file.content);
                    updatedFiles[file.path] = file.content;
                  }

                  return updatedFiles;
                } catch (e) {
                  const errorContext = {
                    tool: "createOrUpdateFiles",
                    files: files.map(f => ({ path: f.path, size: f.content.length })),
                    error: e?.toString()
                  };
                  
                  throw new Error(JSON.stringify(errorContext));
                }
              });

              network.state.data.files = newFiles;
              return "Files created/updated successfully";
            },
          }),
          createTool({
            name: "readFiles",
            description: "Read files from the sandbox",
            parameters: z.object({
              paths: z.array(z.string()),
            }),
            handler: async ({ paths }) => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const fileContents: { [path: string]: string } = {};
                for (const path of paths) {
                  const content = await sandbox.files.read(path);
                  fileContents[path] = content;
                }
                return JSON.stringify(fileContents);
              } catch (e) {
                const errorContext = {
                  tool: "readFiles",
                  paths,
                  error: e?.toString()
                };
                
                throw new Error(JSON.stringify(errorContext));
              }
            },
          }),
        ],
      }),
    ]);

    try {
      const result = await step.run("execute-agent", async () => {
        network.state = state;
        const codeAgent = network.agents.codeAgent;

        const agentResult = await codeAgent.run(
          [{ type: "text", content: event.data.value }]
            .concat(previousMessages)
        );

        network.state.data.summary = lastAssistantTextMessageContent(agentResult.messages);

        return agentResult;
      });

      const isError = !result.state.data.summary || Object.keys(result.state.data.files || {}).length === 0;

      if (isError) {
        return await handleError(
          new Error("Agent execution failed - no summary or files generated"),
          { value: event.data.value, previousMessages },
          event.data.projectId
        );
      }

      // Success case - create normal result
      const assistantMessage = await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: lastAssistantTextMessageContent(result.messages),
          role: "ASSISTANT",
          type: "RESULT",
        },
      });

      // Rest of success handling...
      const fragmentTitle = await step.run("generate-fragment-title", async () => {
        const titleNetwork = createNetwork([
          createAgent({
            name: "title-agent",
            client: openai({
              model: "gpt-4o-mini",
              apiKey: process.env.OPENAI_API_KEY!,
            }),
            system: FRAGMENT_TITLE_PROMPT,
          }),
        ]);

        const titleAgent = titleNetwork.agents.titleAgent;
        const titleResult = await titleAgent.run([
          { type: "text", content: `<task_summary>${result.state.data.summary}</task_summary>` },
        ]);

        return parseAgentOutput(titleResult.messages);
      });

      const fragmentDescription = await step.run("generate-fragment-description", async () => {
        const responseNetwork = createNetwork([
          createAgent({
            name: "response-agent",
            client: openai({
              model: "gpt-4o-mini",
              apiKey: process.env.OPENAI_API_KEY!,
            }),
            system: RESPONSE_PROMPT,
          }),
        ]);

        const responseAgent = responseNetwork.agents.responseAgent;
        const responseResult = await responseAgent.run([
          { type: "text", content: `<task_summary>${result.state.data.summary}</task_summary>` },
        ]);

        return parseAgentOutput(responseResult.messages);
      });

      const sandbox = await getSandbox(sandboxId);
      const sandboxUrl = await sandbox.getHostname(3000);

      await prisma.fragment.create({
        data: {
          messageId: assistantMessage.id,
          sandboxUrl,
          title: fragmentTitle,
          files: result.state.data.files || {},
        },
      });

      await prisma.message.update({
        where: { id: assistantMessage.id },
        data: { content: fragmentDescription },
      });

      return assistantMessage;

    } catch (error) {
      return await handleError(
        error,
        { 
          value: event.data.value, 
          previousMessages,
          executionStep: "agent-execution"
        },
        event.data.projectId
      );
    }
  }
);