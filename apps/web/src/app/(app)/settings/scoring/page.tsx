"use client";

import { trpc } from "@/lib/trpc/client";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Switch, Badge, Skeleton } from "@digitify/ui";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function ScoringSettingsPage() {
  const { data: weights, isLoading } = trpc.settings.getScoringWeights.useQuery();
  const utils = trpc.useUtils();

  const updateWeight = trpc.settings.updateScoringWeight.useMutation({
    onSuccess: () => utils.settings.getScoringWeights.invalidate(),
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-4">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Scoring Engine</h1>
          <p className="text-sm text-muted-foreground">
            Pas de gewichten per scoring factor aan
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Scoring Factoren</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {weights?.map((weight: NonNullable<typeof weights>[number]) => (
            <div key={weight.id} className="flex items-center gap-4 rounded-lg border p-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{weight.label}</p>
                  {weight.category && (
                    <Badge variant="outline" className="text-[10px]">{weight.category}</Badge>
                  )}
                </div>
                {weight.description && (
                  <p className="text-xs text-muted-foreground">{weight.description}</p>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Gewicht</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    className="w-20"
                    defaultValue={weight.weight}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val !== weight.weight) {
                        updateWeight.mutate({ id: weight.id, weight: val });
                      }
                    }}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Max</Label>
                  <p className="text-sm text-center font-mono">{weight.maxPoints}</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Actief</Label>
                  <div className="pt-0.5">
                    <Switch
                      checked={weight.enabled}
                      onCheckedChange={(enabled) =>
                        updateWeight.mutate({ id: weight.id, enabled })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
