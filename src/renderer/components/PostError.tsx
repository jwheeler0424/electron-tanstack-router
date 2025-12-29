import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { ErrorComponent, useRouter } from "@tanstack/react-router";
import * as React from "react";
import { PostNotFoundError } from "../posts";

export function PostErrorComponent({ error }: ErrorComponentProps) {
  const router = useRouter();
  if (error instanceof PostNotFoundError) {
    return <div>{error.message}</div>;
  }
  const queryErrorResetBoundary = useQueryErrorResetBoundary();

  React.useEffect(() => {
    queryErrorResetBoundary.reset();
  }, [queryErrorResetBoundary]);

  return (
    <div>
      <button
        onClick={() => {
          router.invalidate();
        }}
      >
        retry
      </button>
      <ErrorComponent error={error} />
    </div>
  );
}
