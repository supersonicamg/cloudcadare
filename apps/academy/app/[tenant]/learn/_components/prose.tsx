import Markdown from 'react-markdown'

// Lesson articles are Markdown written by staff. react-markdown renders to React elements (no raw HTML,
// javascript: links are dropped); images are off so a lesson cannot call third-party servers per learner.
export function Prose({ text }: { text: string }) {
  return (
    <div className="max-w-[40em] text-[19px] leading-[1.65] text-[#2C3736]">
      <Markdown
        disallowedElements={['img']}
        components={{
          h1: (p) => <h2 className="mt-8 mb-2.5 font-heading text-2xl font-bold tracking-[-0.025em] text-fg" {...p} />,
          h2: (p) => <h2 className="mt-8 mb-2.5 font-heading text-2xl font-bold tracking-[-0.025em] text-fg" {...p} />,
          h3: (p) => <h3 className="mt-8 mb-2.5 font-heading text-2xl font-bold tracking-[-0.025em] text-fg" {...p} />,
          p: (p) => <p className="my-4" {...p} />,
          ul: (p) => <ul className="my-4 list-disc space-y-1.5 pl-6 marker:text-primary" {...p} />,
          ol: (p) => <ol className="my-4 list-decimal space-y-1.5 pl-6" {...p} />,
          a: (p) => <a className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...p} />,
          blockquote: (p) => <blockquote className="my-5 rounded-[14px] bg-tint-2 px-5 py-4 text-[17px] leading-snug text-fg" {...p} />,
          code: (p) => <code className="rounded bg-tint-1 px-1.5 py-0.5 text-[0.9em]" {...p} />,
          pre: (p) => <pre className="my-5 overflow-x-auto rounded-[14px] bg-deep px-5 py-[18px] font-mono text-[15px] font-medium leading-[1.6] text-[#E6F2EE] [&_code]:bg-transparent [&_code]:p-0" {...p} />,
        }}
      >
        {text}
      </Markdown>
    </div>
  )
}
