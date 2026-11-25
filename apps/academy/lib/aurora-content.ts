import type { HomeContent, NavItem, SiteContent } from '@educore/ui/theme'

// Copy for the `aurora` theme (CloudCadre). It stands in for CMS blocks (plan/05 §4) until the block
// editor exists; each key maps to one block type. The design rules are in plan/15-design-and-ux-guide.md and the
// reference build is plan/mockups/homepage-v9.html. CloudCadre sells one program for now: CEAP.
//
// PLACEHOLDER DATA. Everything marked INVENTED below came from the design mockup and is NOT real. The full list
// is plan/15 §15. Showing invented figures, people or placements to the public is misleading advertising, so
// replace or delete each of them before the site goes live:
//   - the syllabus: month split, topics, lab counts, hours a week, the batch date "12 Jan", the "-32%" in month 2
//   - social proof: the hero's review score and count and "420+ placed" (the placements section is real, see there)
//   - people: the counsellor's name, photo and reply times
//   - images: every photo is a stock photo (Unsplash) that stands in for CloudCadre's own
// A section left out of this object is simply not rendered. The WhatsApp number and phone are never written here:
// they come from the academy's contact settings, and every WhatsApp control disappears when there is none.

// stock placeholder: Unsplash id → URL
const photo = (id: string, w: number, extra = '') => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}${extra}&q=75`

// The real placement photos live on the old site's Cloudinary account. `f_auto,q_auto,w_700` makes it send a small,
// modern-format copy instead of the 1024px original. Move them to the academy's own storage before the old site goes.
const cld = (path: string) => `https://res.cloudinary.com/dqw5bkqgz/image/upload/f_auto,q_auto,w_700/${path}.jpg`

// Employer logos in apps/academy/public/cloudcadre/logos/ (SVG, cropped to the mark). Sources: Infosys and Zensar from
// Simple Icons (CC0), Capgemini, Amdocs, ZS, HCLTech and Persistent from Wikimedia Commons. They are trademarks of their
// owners, shown only to say where learners work (the footer disclaimer covers this). NOT yet available, so the name is
// shown as text: NICE, Cencora, Truetech, Fabutech, SA Technologies. Add each one's official SVG to that folder and a
// `logo: logo('<file>')` here. (Do not use scraped favicons: they are blurry and do not match the wordmarks.)
const logo = (file: string) => `/cloudcadre/logos/${file}.svg`

export const auroraNav: NavItem[] = [
  { label: 'Program', href: '/#program' },
  { label: 'How we teach', href: '/#how' },
  { label: 'Placements', href: '/#placements' },
  { label: 'FAQ', href: '/#talk' },
]

export const auroraSite: SiteContent = {
  footerColumns: [
    { title: 'Program', links: [
      { label: 'Curriculum', href: '/#program' },
      { label: 'How we teach', href: '/#how' },
      { label: 'Placements', href: '/#placements' },
    ] },
    { title: 'Academy', links: [
      { label: 'FAQ', href: '/#talk' },
    ] },
  ],
  // stock placeholder
  authArt: { image: { src: photo('1531482615713-2afd69097998', 900), alt: 'Learners working through a cloud lab together' }, tag: 'Taught by working engineers' },
  disclaimer: 'AWS, Azure, Google Cloud, Kubernetes and other marks belong to their owners.',
}

export const auroraHome: HomeContent = {
  hero: {
    headline: { lead: 'Become a', accent: 'cloud architect', mark: 'in 4 months.' },
    lead: 'A live program in cloud, FinOps and DevOps, taught by engineers who run it.',
    facts: [
      { icon: 'clock', text: '4 months, live online' },
      { icon: 'calendar', text: 'Next batch: 12 Jan' }, // INVENTED date
      { icon: 'flag', text: 'Capstone + interview prep' },
    ],
    // Where "Join the next batch" goes. /courses until the program page exists (plan/15 §14).
    primaryCta: { label: 'Join the next batch', href: '/courses' },
    trust: { stars: 5, score: '4.8', reviews: '1,200+ reviews', placed: { value: '420+', label: 'learners placed' } }, // INVENTED
    // stock placeholder: an architect's desk from above, no people. Replace with the generated desk flat-lay
    // (plan/15 §15), or remove `image` to show the CEAP drawing instead.
    image: { src: photo('1488190211105-8b0e65b80b4e', 1200), alt: 'An architect’s desk from above: notebook, laptop and coffee' },
    imageTag: { text: 'Next batch starts 12 Jan', link: { label: 'Join', href: '/courses' } }, // INVENTED date
    builtFor: {
      title: 'Built for',
      // stock placeholders
      items: [
        { image: { src: photo('1543269865-cbf427effbad', 720), alt: 'Young graduates studying together at a table' }, intro: 'If you are a', label: 'Fresher', outcome: 'Cloud engineer' },
        { image: { src: photo('1573164713988-8665fc963095', 720), alt: 'An IT professional with a tablet in a server room' }, intro: 'If you are an', label: 'IT professional', outcome: 'Cloud architect' },
        { image: { src: photo('1551836022-d5d88e9218df', 720), alt: 'Two finance colleagues talking over a laptop' }, intro: 'If you work in', label: 'Finance or ops', outcome: 'FinOps analyst' },
      ],
    },
  },
  // syllabusHref: set to the syllabus PDF to show every "Download the syllabus" link.

  program: {
    title: 'Four months, one step at a time',
    lead: 'Each month builds on the last. Tap a month to see what you learn and build.',
    goal: 'Cloud architect',
    // INVENTED syllabus: check the months, topics, outcomes and lab counts against the real CEAP syllabus.
    months: [
      {
        title: 'Three clouds, one architecture', weeks: [1, 4], logos: ['aws', 'azure', 'gcp'], diagram: 'clouds',
        outcome: 'run the same app on AWS, Azure and Google Cloud, and explain which fits when.',
        topics: [{ label: 'Core services on AWS', logo: 'aws' }, { label: 'Core services on Azure', logo: 'azure' }, { label: 'Google Cloud basics', logo: 'gcp' }, { label: 'Networking and identity' }, { label: 'Security foundations' }],
        build: 'The same 3-tier app on all three clouds', meta: '12 hands-on labs',
      },
      {
        title: 'FinOps and cloud costs', weeks: [5, 8], logos: ['finops'], diagram: 'bill',
        outcome: 'find the waste in a cloud bill and show finance what it saves.',
        topics: [{ label: 'Reading cloud bills', logo: 'finops' }, { label: 'Cost optimisation' }, { label: 'Budgets and accountability' }, { label: 'Tagging and governance' }, { label: 'Unit economics' }],
        build: 'A savings plan for a real cloud bill', meta: '8 hands-on labs', // INVENTED: the "−32%" in the drawing
      },
      {
        title: 'Automate and ship', weeks: [9, 12], logos: ['terraform', 'docker', 'kubernetes'], diagram: 'pipeline',
        outcome: 'ship an app to Kubernetes through one pipeline, with every server built from code.',
        topics: [{ label: 'Terraform and IaC', logo: 'terraform' }, { label: 'Docker', logo: 'docker' }, { label: 'Kubernetes', logo: 'kubernetes' }, { label: 'CI/CD pipelines', logo: 'github' }, { label: 'Automated provisioning' }],
        build: 'A pipeline that ships an app to Kubernetes, built with Terraform', meta: '14 hands-on labs',
      },
      {
        title: 'Design, defend, get hired', weeks: [13, 16], icons: ['flag', 'briefcase'], diagram: 'review',
        outcome: 'design an enterprise architecture, defend it in a review, and interview for the job.',
        topics: [{ label: 'Architecture design' }, { label: 'Migration strategies' }, { label: 'Security and governance' }, { label: 'Mock interviews' }, { label: 'CV and LinkedIn' }],
        build: 'Capstone: design and defend a multi-cloud migration', meta: 'Capstone review + 2 mock interviews',
      },
    ],
  },

  how: {
    title: 'How we teach',
    lead: 'Small live batches, real labs, a project you defend.',
    // stock placeholders: swap for CloudCadre's own class and lab photos
    tiles: [
      { image: { src: photo('1522202176988-66273c2fd55f', 1000), alt: 'A small group of learners in a live class with laptops' }, title: 'Live classes, 30 seats', line: 'Your trainer knows your name' }, // INVENTED seat count
      { image: { src: photo('1522071820081-009f0129c71c', 1000), alt: 'Learners working through a lab on their laptops' }, title: 'Labs a mentor checks', line: 'On a real cloud account' },
      { image: { src: photo('1552664730-d307ca884978', 700), alt: 'A learner presenting a system design on a whiteboard' }, title: 'Defend your project', line: 'Like a real interview' },
    ],
    // The certificate artwork is a placeholder design (apps/academy/public/cloudcadre/).
    certificate: {
      image: { src: '/cloudcadre/ceap-certificate.webp', alt: 'Sample CEAP certificate of completion from CloudCadre, with a QR code and certificate ID' },
      title: 'A certificate employers verify', line: 'Scan the code, see it’s real',
    },
  },

  // REAL placements, taken from the old CloudCadre website's "partners" list (2026-11-25), so they are no longer
  // invented. Before launch confirm with each learner that they agree to be shown, and check the photos:
  //  - every photo has a small sparkle mark in its bottom-right corner (it looks like an AI photo tool's mark), and
  //    Shubham Kulkarni's photo shows three people. plan/15 §10 allows real photos of real people only.
  //  - the old list gives two job titles for Prasad Suryawanshi and Atish Sonwane; the `role` field is used here.
  // Packages are the "Lacs / lakhs" from the old text (CTC, in lakhs per year). The stats below are counted from
  // this list only (no "average", because 15 hand-picked stories would flatter it). Order is the old site's displayOrder.
  placements: {
    title: 'Where our learners work now',
    stats: [
      { value: '15', label: 'Placement stories' }, { value: '12', label: 'Companies' }, { value: '₹29 LPA', label: 'Highest package' },
    ],
    items: [
      { name: 'Swapnil Khandare', photo: cld('v1779696875/finops/partners/wq8vsntaol8qea1jijb8'), lpa: '17', now: 'Cloud Engineer', company: 'Infosys', logo: logo('infosys') },
      { name: 'Shubham Kulkarni', photo: cld('v1779774796/finops/partners/eoctu1xlij4zjufqy010'), lpa: '14', now: 'Cloud Engineer', company: 'Infosys', logo: logo('infosys') },
      { name: 'Shrinath Gaikwad', photo: cld('v1779775162/finops/partners/inih6zmlzkcrvwmq7jqy'), lpa: '8', now: 'DevOps Engineer', company: 'HCL Technologies', logo: logo('hcltech'), city: 'Pune' },
      { name: 'Rupali Janapure', photo: cld('v1779775550/finops/partners/vdycpmti6ndbv4fnnlck'), lpa: '12', now: 'Cloud FinOps Specialist', company: 'Amdocs', logo: logo('amdocs'), city: 'Pune' },
      { name: 'Priyanka Dhavle', photo: cld('v1779775797/finops/partners/pkws9p6zmrfb1wmzdn9e'), lpa: '27', now: 'AWS DevOps Engineer', company: 'Capgemini', logo: logo('capgemini') },
      { name: 'Prashant Jawalkar', photo: cld('v1779775977/finops/partners/rxb2j3nfydwzcsvchi6s'), lpa: '18', now: 'Cloud FinOps Engineer', company: 'Infosys', logo: logo('infosys'), city: 'Pune' },
      { name: 'Prasad Suryawanshi', photo: cld('v1779776202/finops/partners/lbotu68t8kupfwqwrjyh'), lpa: '12.5', now: 'Cloud FinOps Admin', company: 'ZS Associates', logo: logo('zs') },
      { name: 'Prakash Gulbhele', photo: cld('v1779776432/finops/partners/blck4mtyzs7rujlbor7y'), lpa: '16', now: 'AWS FinOps Engineer', company: 'Truetech' },
      { name: 'Ninand Bhoir', photo: cld('v1779776610/finops/partners/bq3rw6vjqcokhwvaz50s'), lpa: '13', now: 'AWS Developer', company: 'SA Technologies', city: 'Mumbai' },
      { name: 'Monika Singh', photo: cld('v1779776907/finops/partners/ot1kjhdy0fjn8cym60q6'), lpa: '27', now: 'Senior Program Manager, AWS and Cloud', company: 'NICE', city: 'Pune' },
      { name: 'Mayuri Fate', photo: cld('v1779777079/finops/partners/d9hfe13d8rrbe1j1okef'), lpa: '13', now: 'Cloud Engineer', company: 'HCLTech', logo: logo('hcltech') },
      { name: 'Lalit Borse', photo: cld('v1779777581/finops/partners/pqtkm6wpsvd8zdjysg4t'), lpa: '29', now: 'Technical Specialist, Cloud and FinOps', company: 'Zensar', logo: logo('zensar'), city: 'Pune' },
      { name: 'Abhilesh Jadhao', photo: cld('v1779777941/finops/partners/xeqthvtjcqo4pbk4tcgm'), lpa: '19', now: 'Project Manager, Cloud and DC', company: 'Fabutech', city: 'Mumbai' },
      { name: 'Atish Sonwane', photo: cld('v1779778117/finops/partners/ipu40he74efuwwiocpzu'), lpa: '20', now: 'Senior Cloud Engineer, FinOps', company: 'Persistent Systems', logo: logo('persistent'), city: 'Pune' },
      { name: 'Ashish Kumbhojkar', photo: cld('v1779696513/finops/partners/bmphc8rteevycsbqc1i7'), lpa: '14', now: 'Cloud FinOps Engineer', company: 'Cencora', city: 'Pune' },
    ],
  },

  talk: {
    title: 'Still deciding? Ask a person.',
    lead: 'Message Ananya on WhatsApp, or find your answer below.', // INVENTED counsellor
    counsellor: {
      // INVENTED: name, portrait, reply time and hours. The number comes from the academy's contact settings.
      name: 'Ananya Rao', role: 'Admissions counsellor, CloudCadre',
      photo: photo('1567532939604-b6b5b0db2604', 160, '&h=160&crop=faces'),
      line: 'Ask about the program, batch dates or fees. She usually replies within 15 minutes.',
      message: 'Hi! I have a question about CEAP.',
      hours: '9am to 9pm, Mon to Sat',
    },
    // Check each answer against CloudCadre's real policies before launch (hours, recordings, instalments, exam fees).
    faq: [
      { question: 'Do I need an IT background?', answer: 'No. Month 1 starts from cloud basics. If you are completely new to IT, a counsellor will suggest a short warm-up first.' },
      { question: 'How many hours a week?', answer: 'About 8 to 10: two or three live evening classes, plus labs in your own time.' }, // INVENTED
      { question: 'What if I miss a class?', answer: 'Every class is recorded and up the same night, and your mentor helps you catch up on the lab.' },
      { question: 'Can I pay in instalments?', answer: 'Yes. Pay by UPI, card or net banking, in one go or monthly.' },
      { question: 'Do I get a certificate?', answer: 'Yes, a CEAP certificate employers can verify online. AWS, Azure and Google Cloud exam fees are paid to the exam provider.' },
      { question: 'Do you guarantee a job?', answer: 'No, and be wary of anyone who does. We give you the skills, a capstone, mock interviews, CV and LinkedIn help, and introductions.' },
    ],
    nextBatch: { title: 'Next batch starts 12 Jan', meta: '4 months · live online · capstone and interview prep' }, // INVENTED date
  },
}
