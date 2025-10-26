import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import TextareaAutosize from "react-textarea-autosize";
import { ArrowUpIcon, Loader2Icon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { AvatarAgent } from "@/components/avatar-agent";
import { AvatarToggle } from "@/components/avatar-toggle";
import { useAvatarMode } from "@/hooks/use-avatar-mode";

import { Usage } from "./usage";

interface Props {
  projectId: string;
}

const formSchema = z.object({
  value: z.string()
    .min(1, { message: "Value is required" })
    .max(10000, { message: "Value is too long" }),
})

export const MessageFormWithAvatar = ({ projectId }: Props) => {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAvatarMode, isAvatarAvailable } = useAvatarMode();

  const { data: usage } = useQuery(trpc.usage.status.queryOptions());

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      value: "",
    },
  });
  
  const createMessage = useMutation(trpc.messages.create.mutationOptions({
    onSuccess: () => {
      form.reset();
      queryClient.invalidateQueries(
        trpc.messages.getMany.queryOptions({ projectId }),
      );
      queryClient.invalidateQueries(
        trpc.usage.status.queryOptions()
      );
    },
    onError: (error) => {
      toast.error(error.message);

      if (error.data?.code === "TOO_MANY_REQUESTS") {
        router.push("/pricing");
      }
    },
  }));
  
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    await createMessage.mutateAsync({
      value: values.value,
      projectId,
    });
  };

  // Handle avatar message submission
  const handleAvatarMessage = async (message: string) => {
    try {
      await createMessage.mutateAsync({
        value: message,
        projectId,
      });
    } catch (error) {
      console.error("Error submitting avatar message:", error);
    }
  };
  
  const [isFocused, setIsFocused] = useState(false);
  const isPending = createMessage.isPending;
  const isButtonDisabled = isPending || !form.formState.isValid;
  const showUsage = !!usage;

  // Show avatar mode if enabled and available
  if (isAvatarMode && isAvatarAvailable) {
    return (
      <div className="space-y-4">
        {showUsage && (
          <Usage
            points={usage.remainingPoints}
            msBeforeNext={usage.msBeforeNext}
          />
        )}
        
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium">Avatar Assistant</h3>
          <AvatarToggle />
        </div>
        
        <AvatarAgent
          projectId={projectId}
          onMessage={handleAvatarMessage}
          onError={(error) => toast.error(error)}
          className="w-full"
          height="400px"
          avatarUrl={process.env.NODE_ENV === 'development' 
            ? "http://127.0.0.1:5501/" 
            : "http://127.0.0.1:5501/0f37fcdd-9a61-4610-bc02-696a4768dca4/"
          }
        />
        
        {isPending && (
          <div className="flex items-center justify-center py-4">
            <div className="flex items-center gap-2">
              <Loader2Icon className="size-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Processing your request...</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default text mode
  return (
    <Form {...form}>
      {showUsage && (
        <Usage
          points={usage.remainingPoints}
          msBeforeNext={usage.msBeforeNext}
        />
      )}
      
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn(
          "relative border p-4 pt-1 rounded-xl bg-sidebar dark:bg-sidebar transition-all",
          isFocused && "shadow-xs",
          showUsage && "rounded-t-none",
        )}
      >
        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <TextareaAutosize
              {...field}
              disabled={isPending}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              minRows={2}
              maxRows={8}
              className="pt-4 resize-none border-none w-full outline-none bg-transparent"
              placeholder="What would you like to build?"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  form.handleSubmit(onSubmit)(e);
                }
              }}
            />
          )}
        />
        <div className="flex gap-x-2 items-end justify-between pt-2">
          <div className="flex items-center gap-4">
            <div className="text-[10px] text-muted-foreground font-mono">
              <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span>&#8984;</span>Enter
              </kbd>
              &nbsp;to submit
            </div>
            {isAvatarAvailable && <AvatarToggle />}
          </div>
          <Button
            disabled={isButtonDisabled}
            className={cn(
              "size-8 rounded-full",
              isButtonDisabled && "bg-muted-foreground border"
            )}
          >
            {isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <ArrowUpIcon />
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};