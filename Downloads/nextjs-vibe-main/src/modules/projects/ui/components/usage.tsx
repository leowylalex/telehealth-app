import Link from "next/link";
import { useMemo, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { CrownIcon } from "lucide-react";
import { formatDuration, intervalToDuration } from "date-fns";

import { Button } from "@/components/ui/button";

function useMockProAccess() {
  const [mockPro, setMockPro] = useState(false);
  
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setMockPro(localStorage.getItem('mock_pro_access') === 'true');
    }
  }, []);
  
  return mockPro;
}

interface Props {
  points: number;
  msBeforeNext: number;
};

export const Usage = ({ points, msBeforeNext }: Props) => {
  const { has } = useAuth();
  const mockPro = useMockProAccess();
  const hasProAccess = mockPro || has?.({ plan: "pro" });

  const resetTime = useMemo(() => {
    try {
      return formatDuration(
        intervalToDuration({
          start: new Date(),
          end: new Date(Date.now() + msBeforeNext),
        }),
        { format: ["months", "days", "hours"] }
      )
    } catch (error) {
      console.error("Error formatting duration ", error);
      return "unknown";
    }
  }, [msBeforeNext]);

  return (
    <div className="rounded-t-xl bg-background border border-b-0 p-2.5">
      <div className="flex items-center gap-x-2">
        <div>
          <p className="text-sm">
            {points} {hasProAccess ? "": "free"} credits remaining
          </p>
          <p className="text-xs text-muted-foreground">
            Resets in{" "}{resetTime}
          </p>
        </div>
        {!hasProAccess && (
          <Button
            asChild
            size="sm"
            variant="tertiary"
            className="ml-auto"
          >
            <Link href="/pricing">
              <CrownIcon /> Upgrade
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};
