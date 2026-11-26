import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Lesson articles are Markdown written by staff. react-markdown renders to React elements (no raw HTML,
// javascript: links are dropped); images are off so a lesson cannot call third-party servers per learner.
// Tables, task lists and strike-through (GitHub-style Markdown) are on: course notes are full of tables.
//
// Two looks: the lesson page (inside the v11 frame, `v11`) takes the `.prose` rules of study.css; the public free-preview page,
// which sits outside the v11 frame, keeps the Tailwind classes below (the default).
export function Prose({ text, v11 = false }: { text: string; v11?: boolean }) {
  if (v11) {
    return (
      <div className="prose">
        <Markdown remarkPlugins={[remarkGfm]} disallowedElements={['img']}
          components={{
            h1: (p) => <h2 {...p} />,
            a: (p) => <a target="_blank" rel="noopener noreferrer" {...p} />,
            table: (p) => <div className="tbl"><table {...p} /></div>,
          }}>
          {text}
        </Markdown>
      </div>
    )
  }
  return (
    <div className="max-w-[44em] text-[18.5px] leading-[1.7] text-[#2C3736]">
      <Markdown
        remarkPlugins={[remarkGfm]}
        disallowedElements={['img']}
        components={{
          h1: (p) => <h2 className="mt-9 mb-2.5 font-heading text-2xl font-bold tracking-[-0.025em] text-fg" {...p} />,
          h2: (p) => <h2 className="mt-9 mb-2.5 font-heading text-2xl font-bold tracking-[-0.025em] text-fg" {...p} />,
          h3: (p) => <h3 className="mt-8 mb-2 font-heading text-[21px] font-bold tracking-[-0.02em] text-fg" {...p} />,
          p: (p) => <p className="my-4" {...p} />,
          ul: (p) => <ul className="my-4 list-disc space-y-1.5 pl-6 marker:text-primary" {...p} />,
          ol: (p) => <ol className="my-4 list-decimal space-y-1.5 pl-6 marker:font-semibold marker:text-primary" {...p} />,
          a: (p) => <a className="font-medium text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...p} />,
          blockquote: (p) => <blockquote className="my-5 rounded-[14px] border-l-4 border-accent bg-tint-2 px-5 py-4 text-[17px] leading-snug text-fg" {...p} />,
          code: (p) => <code className="rounded bg-tint-1 px-1.5 py-0.5 text-[0.9em]" {...p} />,
          pre: (p) => <pre className="my-5 overflow-x-auto rounded-[14px] bg-deep px-5 py-[18px] font-mono text-[15px] font-medium leading-[1.6] text-[#E6F2EE] [&_code]:bg-transparent [&_code]:p-0" {...p} />,
          table: (p) => <div className="my-5 overflow-x-auto rounded-[14px] border border-border"><table className="w-full border-collapse text-left text-[16.5px] leading-snug" {...p} /></div>,
          th: (p) => <th className="border-b-2 border-fg bg-muted px-4 py-3 font-bold text-fg" {...p} />,
          td: (p) => <td className="border-t border-border px-4 py-3 align-top" {...p} />,
        }}
      >
        {text}
      </Markdown>
    </div>
  )
}
