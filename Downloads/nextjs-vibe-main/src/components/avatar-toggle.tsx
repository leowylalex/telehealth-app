"use client";

import { BotIcon, MessageSquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAvatarMode } from "@/hooks/use-avatar-mode";

interface AvatarToggleProps {
  className?: string;
}

export const AvatarToggle = ({ className = "" }: AvatarToggleProps) => {
  const { isAvatarMode, isAvatarAvailable, toggleMode } = useAvatarMode();

  if (!isAvatarAvailable) {
    return null; // Don't show toggle if avatar is not available
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Button
        variant={!isAvatarMode ? "default" : "outline"}
        size="sm"
        onClick={toggleMode}
        className="flex items-center gap-2"
        disabled={!isAvatarAvailable}
      >
        <MessageSquareIcon className="size-4" />
        <span className="hidden sm:inline">Text</span>
      </Button>
      <Button
        variant={isAvatarMode ? "default" : "outline"}
        size="sm"
        onClick={toggleMode}
        className="flex items-center gap-2"
        disabled={!isAvatarAvailable}
      >
        <BotIcon className="size-4" />
        <span className="hidden sm:inline">Avatar</span>
      </Button>
    </div>
  );
};