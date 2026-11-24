export const metadata = { title: 'Address not found' }

export default function UnknownHost() {
  return (
    <>
      <h1 className="font-heading text-[clamp(28px,5vw,38px)] font-extrabold leading-[1.08] tracking-[-0.035em]">This address isn&rsquo;t an academy</h1>
      <p className="mt-4 text-[17px] leading-relaxed text-grey">
        Check the link you were given, and that it is spelled exactly as shared. If you run an academy and this address should be yours, contact your account manager.
      </p>
    </>
  )
}
