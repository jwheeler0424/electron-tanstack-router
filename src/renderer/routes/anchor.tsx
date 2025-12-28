import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/anchor')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/anchor"!</div>
}
