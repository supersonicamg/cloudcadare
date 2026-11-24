export const metadata = { title: 'Temporarily unavailable' }

export default function Suspended() {
  return (
    <>
      <h1 className="font-heading text-[clamp(28px,5vw,38px)] font-extrabold leading-[1.08] tracking-[-0.035em]">This academy is temporarily unavailable</h1>
      <p className="mt-4 text-[17px] leading-relaxed text-grey">
        Please check back soon. Learners with an account keep their progress. If this is urgent, contact the academy directly.
      </p>
    </>
  )
}
