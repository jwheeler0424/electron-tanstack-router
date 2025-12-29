import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PostErrorComponent } from "../components/PostError";
import { postQueryOptions } from "../postQueryOptions";

export const Route = createFileRoute("/posts/$postId")({
  loader: ({ context: { queryClient }, params: { postId } }) => {
    return queryClient.ensureQueryData(postQueryOptions(postId));
  },
  errorComponent: PostErrorComponent,
  component: PostComponent,
});

function PostComponent() {
  const postId = Route.useParams().postId;
  const { data: post } = useSuspenseQuery(postQueryOptions(postId));

  return (
    <div className="space-y-2">
      <h4 className="text-xl font-bold underline">{post.title}</h4>
      <div className="text-sm">{post.body}</div>
    </div>
  );
}
