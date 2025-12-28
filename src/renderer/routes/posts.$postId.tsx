import { createFileRoute } from "@tanstack/react-router";
import { PostErrorComponent } from "src/renderer/components/PostError";
import { fetchPost } from "../posts";

export const Route = createFileRoute("/posts/$postId")({
  loader: async ({ params: { postId } }) => fetchPost(postId),
  errorComponent: PostErrorComponent,
  notFoundComponent: () => {
    return <p>Post not found</p>;
  },
  component: PostComponent,
});

function PostComponent() {
  const post = Route.useLoaderData();

  return (
    <div className="space-y-2">
      <h4 className="text-xl font-bold underline">{post.title}</h4>
      <div className="text-sm">{post.body}</div>
    </div>
  );
}
