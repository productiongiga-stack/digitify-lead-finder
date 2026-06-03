"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const mergedClassName = cn(className);
  const useCustomTabsList =
    mergedClassName.includes("settings-domain-tabs") ||
    mergedClassName.includes("page-view-tabs") ||
    mergedClassName.includes("bookings-view-tabs") ||
    mergedClassName.includes("meta-ads-tabs") ||
    mergedClassName.includes("ads-studio-tabs");

  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        !useCustomTabsList &&
          "inline-flex h-8 items-center justify-center rounded-lg bg-muted p-0.5 text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const mergedTriggerClass = cn(className);
  const useCustomTabTrigger =
    mergedTriggerClass.includes("settings-domain-tab") ||
    mergedTriggerClass.includes("page-view-tabs-trigger") ||
    mergedTriggerClass.includes("bookings-view-tab-trigger") ||
    mergedTriggerClass.includes("meta-ads-tabs-trigger") ||
    mergedTriggerClass.includes("ads-studio-tabs-trigger");

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        !useCustomTabTrigger &&
          "inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-0.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
        className,
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
