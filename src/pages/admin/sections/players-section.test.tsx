import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"

import { AddPlayerForm } from "@/pages/admin/sections/players-section"
import { server } from "@/test/setup"

function renderAddPlayer() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AddPlayerForm />
    </QueryClientProvider>
  )
}

/** Intercept the roster-add POST and record each request body. */
function captureAddRequests() {
  const bodies: Array<Record<string, unknown>> = []
  server.use(
    http.post("*/v1/tournaments/:slug/players", async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>)
      return HttpResponse.json({}, { status: 201 })
    })
  )
  return bodies
}

describe("AddPlayerForm — unified add (#198)", () => {
  it("adds a polled player by profile ID alone", async () => {
    const bodies = captureAddRequests()
    const user = userEvent.setup()
    renderAddPlayer()

    await user.type(screen.getByLabelText("Profile ID"), "1819870")
    await user.click(screen.getByRole("button", { name: "Add" }))

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toEqual({ profile_id: 1819870 })
  })

  it("adds a placeholder by display name alone", async () => {
    const bodies = captureAddRequests()
    const user = userEvent.setup()
    renderAddPlayer()

    await user.type(screen.getByLabelText("Display name"), "uThermal")
    await user.click(screen.getByRole("button", { name: "Add" }))

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toEqual({ name: "uThermal" })
  })

  it("sends the name as a displayName override when both are given", async () => {
    const bodies = captureAddRequests()
    const user = userEvent.setup()
    renderAddPlayer()

    await user.type(screen.getByLabelText("Display name"), "uThermal")
    await user.type(screen.getByLabelText("Profile ID"), "1819870")
    await user.click(screen.getByRole("button", { name: "Add" }))

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toEqual({
      profile_id: 1819870,
      presentation: { displayName: "uThermal" },
    })
  })

  it("disables Add until a name or profile ID is entered", async () => {
    const user = userEvent.setup()
    renderAddPlayer()

    const button = screen.getByRole("button", { name: "Add" })
    expect(button).toBeDisabled()

    await user.type(screen.getByLabelText("Display name"), "uThermal")
    expect(button).toBeEnabled()
  })

  it("blocks a digits-only name when no profile ID is given", async () => {
    const user = userEvent.setup()
    renderAddPlayer()

    await user.type(screen.getByLabelText("Display name"), "1819870")
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled()
    expect(
      screen.getByText(/enter it in the Profile ID field/i)
    ).toBeInTheDocument()
  })
})
