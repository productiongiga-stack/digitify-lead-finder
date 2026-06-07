"use client";

import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc/client";

type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

type UseMediaJobOptions = {
  onCompleted?: (outputUrl: string) => void;
  autoImport?: boolean;
  onAutoImported?: (blobUrl: string) => void;
  onPollError?: (message: string) => void;
};

export function useMediaJob(jobId: string | null, options?: UseMediaJobOptions) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const completedRef = useRef(false);
  const autoImportRef = useRef(false);
  const previousJobIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const onCompletedRef = useRef(options?.onCompleted);
  const onAutoImportedRef = useRef(options?.onAutoImported);
  const onPollErrorRef = useRef(options?.onPollError);

  useEffect(() => {
    onCompletedRef.current = options?.onCompleted;
    onAutoImportedRef.current = options?.onAutoImported;
    onPollErrorRef.current = options?.onPollError;
  }, [options?.onCompleted, options?.onAutoImported, options?.onPollError]);

  const importToBlob = trpc.media.importToBlob.useMutation({
    onSuccess: (result) => {
      if (result.blobUrl) {
        setBlobUrl(result.blobUrl);
        onAutoImportedRef.current?.(result.blobUrl);
      }
    },
  });

  const pollQuery = trpc.media.getJobStatus.useQuery(
    { jobId: jobId || "" },
    {
      enabled: Boolean(jobId) && status !== "COMPLETED" && status !== "FAILED",
      refetchInterval: (query) => {
        const current = query.state.data?.status;
        if (current === "COMPLETED" || current === "FAILED") return false;
        return 2500;
      },
      retry: 2,
    },
  );

  useEffect(() => {
    if (!pollQuery.isError) return;
    const message = pollQuery.error?.message || "Status ophalen mislukt.";
    setPollError(message);
    onPollErrorRef.current?.(message);
  }, [pollQuery.isError, pollQuery.error]);

  useEffect(() => {
    if (!pollQuery.data) return;
    setPollError(null);
    setStatus(pollQuery.data.status as JobStatus);
    setOutputUrl(pollQuery.data.outputUrl ?? null);
    setBlobUrl(pollQuery.data.blobUrl ?? null);
    setErrorMessage(pollQuery.data.errorMessage ?? null);

    if (
      pollQuery.data.status === "COMPLETED" &&
      pollQuery.data.outputUrl &&
      !completedRef.current
    ) {
      completedRef.current = true;
      onCompletedRef.current?.(pollQuery.data.outputUrl);

      if (options?.autoImport && jobId && !pollQuery.data.blobUrl && !autoImportRef.current) {
        autoImportRef.current = true;
        importToBlob.mutate({ jobId });
      }
    }
  }, [pollQuery.data, options?.autoImport, jobId]);

  useEffect(() => {
    if (previousJobIdRef.current === jobId) return;
    previousJobIdRef.current = jobId;
    completedRef.current = false;
    autoImportRef.current = false;
    setStatus(jobId ? "PENDING" : null);
    setOutputUrl(null);
    setBlobUrl(null);
    setErrorMessage(null);
    setPollError(null);
    setElapsedSeconds(0);
    startedAtRef.current = jobId ? Date.now() : null;
  }, [jobId]);

  useEffect(() => {
    if (!jobId || status === "COMPLETED" || status === "FAILED") return;
    const timer = window.setInterval(() => {
      if (startedAtRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [jobId, status]);

  const isActiveJob =
    Boolean(jobId) &&
    status !== "COMPLETED" &&
    status !== "FAILED";

  return {
    status,
    outputUrl,
    blobUrl,
    errorMessage,
    pollError,
    elapsedSeconds,
    isPolling: isActiveJob && (pollQuery.isFetching || status === "PENDING" || status === "PROCESSING"),
    isAutoImporting: importToBlob.isPending,
    refresh: () => {
      setPollError(null);
      void pollQuery.refetch();
    },
  };
}
