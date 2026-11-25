export function NotConfigured() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Console is not connected yet</h1>
      <p className="mt-3 max-w-xl text-fg/70">
        Set <code>CONTROL_DATABASE_URL</code> and the <code>SUPABASE_*</code> variables (see <code>.env.example</code>),
        apply the migrations in <code>packages/db</code>, then reload.
      </p>
    </>
  )
}
