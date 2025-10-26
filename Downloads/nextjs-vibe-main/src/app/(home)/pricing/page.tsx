"use client";

import { dark } from "@clerk/themes";
import { PricingTable } from "@clerk/nextjs";
import { ErrorBoundary } from "react-error-boundary";

import { useCurrentTheme } from "@/hooks/use-current-theme";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PricingFallback = () => {
  const handleUpgrade = () => {
    if (process.env.NODE_ENV === 'development') {
      // Mock upgrade - set local storage flag
      localStorage.setItem('mock_pro_access', 'true');
      // Redirect to home page to see the effect
      window.location.href = '/';
    }
  };

  const handleGetStarted = () => {
    // Just redirect to home for free plan
    window.location.href = '/';
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Free</CardTitle>
          <CardDescription>Perfect for getting started</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">$0</div>
          <p className="text-sm text-muted-foreground">per month</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>✓ 1000 projects (dev mode)</li>
            <li>✓ Basic AI features</li>
            <li>✓ Community support</li>
          </ul>
          <Button className="w-full mt-4" variant="outline" onClick={handleGetStarted}>
            Get Started
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Pro</CardTitle>
          <CardDescription>For power users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">$20</div>
          <p className="text-sm text-muted-foreground">per month</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>✓ Unlimited projects</li>
            <li>✓ Advanced AI features</li>
            <li>✓ Priority support</li>
            <li>✓ Custom templates</li>
          </ul>
          <Button className="w-full mt-4" onClick={handleUpgrade}>
            {process.env.NODE_ENV === 'development' ? 'Simulate Pro Upgrade' : 'Upgrade to Pro'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

const PricingTableWrapper = () => {
  const currentTheme = useCurrentTheme();
  
  // For development, always show fallback since Clerk billing is disabled
  if (process.env.NODE_ENV === 'development') {
    return <PricingFallback />;
  }
  
  // In production, try to render PricingTable with error boundary
  return (
    <ErrorBoundary 
      fallback={<PricingFallback />}
      onError={(error) => {
        console.warn("Clerk billing error:", error.message);
      }}
    >
      <PricingTable
        appearance={{
          baseTheme: currentTheme === "dark" ? dark : undefined,
          elements: {
            pricingTableCard: "border! shadow-none! rounded-lg!"
          }
        }}
      />
    </ErrorBoundary>
  );
};

const Page = () => {
  return ( 
    <div className="flex flex-col max-w-3xl mx-auto w-full">
      <section className="space-y-6 pt-[16vh] 2xl:pt-48">
        <h1 className="text-xl md:text-3xl font-bold text-center">Pricing</h1>
        <p className="text-muted-foreground text-center text-sm md:text-base">
          Choose the plan that fits your needs
        </p>
        <PricingTableWrapper />
      </section>
    </div>
   );
}
 
export default Page;