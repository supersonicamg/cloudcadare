import type { HomeContent, NavItem, SiteContent } from '@educore/ui/theme'

// Copy for the `aurora` theme (CloudCadre). It stands in for CMS blocks (plan/05 §4) until the block
// editor exists; each key maps to one block type. The design rules are in plan/15-design-and-ux-guide.md (version 11)
// and the reference build is plan/mockups/home-v11.html. CloudCadre sells one program for now: CEAP.
//
// PLACEHOLDER DATA. Everything marked INVENTED below came from the design mockup and is NOT real. The full list
// is plan/15 §15. Showing invented figures, people or placements to the public is misleading advertising, so
// replace or delete each of them before the site goes live:
//   - the batch: date "12 Jan", class times (Mon to Thu 8-10 pm, Sat lab 10-1), seats (30), fee (Rs 15,000 x 4, or Rs 60,000)
//   - the program: month split, topics and lab counts (12 / 8 / 14 / "34 labs"), and the syllabus PDF
//   - people: the counsellor's name, photo and reply time
//   - images: every photo except the placements is a stock photo (Unsplash) that stands in for CloudCadre's own
// A section left out of this object is simply not rendered. The WhatsApp number and phone are never written here:
// they come from the academy's contact settings, and every WhatsApp control disappears when there is none.

// stock placeholder: Unsplash id → URL
const photo = (id: string, w: number, extra = '') => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}${extra}&q=75`

// The real placement photos live on the old site's Cloudinary account. The transform makes it send a small, modern-format
// copy: the wall gets a square crop on the face (`face`), the hero the whole photo (`full`). Move them to the academy's
// own storage before the old site goes.
const cld = (path: string, t: 'face' | 'full') =>
  `https://res.cloudinary.com/dqw5bkqgz/image/upload/f_auto,q_auto,${t === 'face' ? 'w_480,h_480,c_fill,g_face' : 'w_1200'}/${path}.jpg`

// Employer logos in apps/academy/public/cloudcadre/logos/ (SVG, cropped to the mark). Sources: Infosys and Zensar from
// Simple Icons (CC0), Capgemini, Amdocs, ZS, HCLTech and Persistent from Wikimedia Commons. They are trademarks of their
// owners, shown only to say where learners work (the footer disclaimer covers this). NOT yet available, so the name is
// shown as text: NICE, Cencora, Truetech, Fabutech, SA Technologies. Add each one's official SVG to that folder and a
// `logo: logo('<file>')` here. (Do not use scraped favicons: they are blurry and do not match the wordmarks.)
const logo = (file: string) => `/cloudcadre/logos/${file}.svg`

// Monika Singh is the hero (plan/15 §10.3): the real placement with the strongest story, shown on sign in and sign up. Needs her written consent.
const MONIKA = 'v1779776907/finops/partners/ot1kjhdy0fjn8cym60q6'


// Order of the sections on the home page (plan/15 §4): placements, program, how classes work, batch, FAQ.
export const auroraNav: NavItem[] = [
  { label: 'Placements', href: '/#placements' },
  { label: 'Program', href: '/#program' },
  { label: 'Fees and dates', shortLabel: 'Fees', href: '/#batch' },
  { label: 'FAQ', href: '/#faq' },
]

export const auroraSite: SiteContent = {
  footerColumns: [
    { title: 'Program', links: [
      { label: 'Placements', href: '/#placements' },
      { label: 'What you build', href: '/#program' },
      { label: 'Fees and dates', href: '/#batch' },
    ] },
    { title: 'Help', links: [
      { label: 'FAQ', href: '/#faq' },
    ] },
  ],
  // stock placeholder
  authArt: { image: { src: photo('1531482615713-2afd69097998', 900), alt: 'Learners working through a cloud lab together' }, tag: 'Taught by working engineers' },
  disclaimer: 'AWS, Azure, Google Cloud, Kubernetes and other marks belong to their owners.',
}

export const auroraHome: HomeContent = {
  hero: {
    headline: 'Become a cloud engineer in 4 months.',
    lead: 'Live online classes in AWS, Azure, DevOps and FinOps.',
    // INVENTED: the date, the class time and the fee. They are the answers to when, what time and how much.
    facts: [
      { label: 'Next batch', value: '12 Jan' },
      { label: 'Classes', value: '8–10 pm' },
      { label: 'Fee', value: '₹15k/month' },
    ],
    // The hero button goes to the batch ticket, so the visitor sees the date and the price before paying.
    primaryCta: { label: 'Join the 12 Jan batch', href: '/#batch' }, // INVENTED date
    // STOCK placeholder: a laptop open on code during a lab. Replace with a real photo of a CloudCadre lab or live class
    // (plan/15 §12); it fades into the dark on its left edge, so pick one whose subject sits on the right.
    photo: { src: photo('1517694712202-14dd9538aa97', 1400), alt: 'A laptop open on code during a lab' },
  },
  // REAL learner on the sign in and sign up pages (the home hero uses a stock photo now). Confirm Monika Singh's written consent before launch.
  authLearner: {
    photo: cld(MONIKA, 'full'), alt: 'Monika Singh, a CloudCadre learner',
    package: '27', name: 'Monika Singh', role: 'Senior Program Manager, AWS and Cloud', company: 'NICE',
  },
  // syllabusHref: set to the syllabus PDF to show the "Full syllabus (PDF)" link.

  // REAL placements, taken from the old CloudCadre website's "partners" list (2026-11-25). Before launch confirm with each
  // learner that they agree to be shown, and check the photos:
  //  - every photo has a small sparkle mark in its bottom-right corner (it looks like an AI photo tool's mark), and
  //    Shubham Kulkarni's photo shows three people. plan/15 §12 allows real photos of real people only.
  //  - the old list gives two job titles for Prasad Suryawanshi and Atish Sonwane; the `role` field is used here.
  // Packages are the "Lacs / lakhs" from the old text (CTC, in lakhs per year). The stats are counted from this list only
  // (no "average", because 15 hand-picked stories would flatter it). "12 companies" counts HCL Technologies and HCLTech once.
  placements: {
    title: 'Where our learners work now',
    stats: [
      { value: '15', label: 'learners' }, { value: '12', label: 'companies' }, { prefix: 'up to', value: '₹29 LPA' },
    ],
    logos: [
      { src: logo('infosys'), alt: 'Infosys' },
      { src: logo('capgemini'), alt: 'Capgemini', size: 'tall' },
      { src: logo('hcltech'), alt: 'HCLTech', size: 'heavy' },
      { src: logo('amdocs'), alt: 'Amdocs' },
      { src: logo('persistent'), alt: 'Persistent Systems' },
      { src: logo('zensar'), alt: 'Zensar', size: 'heavy' },
    ],
    footnote: 'Packages are CTC per year, as shared by each learner.',
    items: [
      { name: 'Priyanka Dhavle', photo: cld('v1779775797/finops/partners/pkws9p6zmrfb1wmzdn9e', 'face'), lpa: '27', now: 'AWS DevOps Engineer', company: 'Capgemini', logo: logo('capgemini') },
      { name: 'Lalit Borse', photo: cld('v1779777581/finops/partners/pqtkm6wpsvd8zdjysg4t', 'face'), lpa: '29', now: 'Technical Specialist, Cloud and FinOps', company: 'Zensar', logo: logo('zensar') },
      { name: 'Atish Sonwane', photo: cld('v1779778117/finops/partners/ipu40he74efuwwiocpzu', 'face'), lpa: '20', now: 'Senior Cloud Engineer, FinOps', company: 'Persistent Systems', logo: logo('persistent') },
      { name: 'Rupali Janapure', photo: cld('v1779775550/finops/partners/vdycpmti6ndbv4fnnlck', 'face'), lpa: '12', now: 'Cloud FinOps Specialist', company: 'Amdocs', logo: logo('amdocs') },
      { name: 'Swapnil Khandare', photo: cld('v1779696875/finops/partners/wq8vsntaol8qea1jijb8', 'face'), lpa: '17', now: 'Cloud Engineer', company: 'Infosys', logo: logo('infosys') },
      { name: 'Abhilesh Jadhao', photo: cld('v1779777941/finops/partners/xeqthvtjcqo4pbk4tcgm', 'face'), lpa: '19', now: 'Project Manager, Cloud and DC', company: 'Fabutech' },
      { name: 'Prashant Jawalkar', photo: cld('v1779775977/finops/partners/rxb2j3nfydwzcsvchi6s', 'face'), lpa: '18', now: 'Cloud FinOps Engineer', company: 'Infosys', logo: logo('infosys') },
      { name: 'Prakash Gulbhele', photo: cld('v1779776432/finops/partners/blck4mtyzs7rujlbor7y', 'face'), lpa: '16', now: 'AWS FinOps Engineer', company: 'Truetech' },
      { name: 'Shubham Kulkarni', photo: cld('v1779774796/finops/partners/eoctu1xlij4zjufqy010', 'face'), lpa: '14', now: 'Cloud Engineer', company: 'Infosys', logo: logo('infosys') },
      { name: 'Ashish Kumbhojkar', photo: cld('v1779696513/finops/partners/bmphc8rteevycsbqc1i7', 'face'), lpa: '14', now: 'Cloud FinOps Engineer', company: 'Cencora' },
      { name: 'Ninand Bhoir', photo: cld('v1779776610/finops/partners/bq3rw6vjqcokhwvaz50s', 'face'), lpa: '13', now: 'AWS Developer', company: 'SA Technologies' },
      { name: 'Mayuri Fate', photo: cld('v1779777079/finops/partners/d9hfe13d8rrbe1j1okef', 'face'), lpa: '13', now: 'Cloud Engineer', company: 'HCLTech', logo: logo('hcltech') },
      { name: 'Prasad Suryawanshi', photo: cld('v1779776202/finops/partners/lbotu68t8kupfwqwrjyh', 'face'), lpa: '12.5', now: 'Cloud FinOps Admin', company: 'ZS Associates', logo: logo('zs') },
      { name: 'Shrinath Gaikwad', photo: cld('v1779775162/finops/partners/inih6zmlzkcrvwmq7jqy', 'face'), lpa: '8', now: 'DevOps Engineer', company: 'HCL Technologies', logo: logo('hcltech') },
      { name: 'Monika Singh', photo: cld(MONIKA, 'face'), lpa: '27', now: 'Senior Program Manager, AWS and Cloud', company: 'NICE' },
    ],
  },

  program: {
    title: 'What you build in 4 months',
    goal: 'Cloud architect', // used by the learner dashboard, not by the home page
    // INVENTED syllabus split: check the months, titles, lines and lab counts against the real CEAP syllabus.
    months: [
      { n: 1, meta: '12 labs', title: 'One app on three clouds', line: 'AWS, Azure and Google Cloud basics', diagram: 'clouds' },
      { n: 2, meta: '8 labs', title: 'A smaller cloud bill', line: 'FinOps: find the waste, show the saving', diagram: 'bill' },
      { n: 3, meta: '14 labs', title: 'Code to Kubernetes', line: 'Terraform, Docker, CI/CD pipelines', diagram: 'pipeline' },
      { n: 4, meta: 'capstone', title: 'Design it, defend it', line: 'Then mock interviews and a CV review', diagram: 'review' },
    ],
  },

  how: {
    title: 'How classes work',
    // stock placeholders: swap for CloudCadre's own class and lab photos. The numbers are placeholders too (seats, labs).
    tiles: [
      { image: { src: photo('1522202176988-66273c2fd55f', 800), alt: 'A small live class with laptops' }, value: '30', line: 'seats in a batch' },
      { image: { src: photo('1522071820081-009f0129c71c', 800), alt: 'Learners working through a lab' }, value: '34', line: 'labs a mentor checks' },
      { image: { src: photo('1517245386807-bb43f82c33c4', 800), alt: 'A learner explaining a design to a reviewer' }, value: '1', line: 'capstone you defend' },
      { image: { src: photo('1551836022-d5d88e9218df', 800), alt: 'A mock interview across a table' }, value: '2', line: 'mock interviews' },
    ],
  },

  // INVENTED: every value of the batch ticket (date, class days and times, fee). Confirm with the owner.
  batch: {
    title: 'Next batch',
    month: 'January 2027',
    day: '12',
    length: '4 months, live online',
    week: [
      { day: 'Mon', kind: 'class', time: ['8–10', 'pm'] },
      { day: 'Tue', kind: 'class', time: ['8–10', 'pm'] },
      { day: 'Wed', kind: 'class', time: ['8–10', 'pm'] },
      { day: 'Thu', kind: 'class', time: ['8–10', 'pm'] },
      { day: 'Fri', kind: 'free' },
      { day: 'Sat', kind: 'lab', time: ['Lab', '10–1'] },
      { day: 'Sun', kind: 'free' },
    ],
    fee: { amount: '₹15,000', per: '/ month × 4', alt: 'or ₹60,000 once · UPI, card, net banking' },
    // /courses until the program page exists (plan/15 §15).
    join: { label: 'Join the 12 Jan batch', href: '/courses' },
    bar: { title: 'Next batch 12 Jan', line: '₹15,000 a month', label: 'Join batch' },
  },

  talk: {
    faqTitle: 'Questions before you join',
    // INVENTED: the counsellor's name, portrait and reply time. The number comes from the academy's contact settings.
    counsellor: {
      name: 'Ananya Rao', role: 'Admissions counsellor · replies in about 15 min',
      photo: photo('1573497019940-1c28c88b4f3e', 800),
      message: 'Hi! I have a question about CEAP.',
    },
    // Check each answer against CloudCadre's real policies before launch (hours, recordings, exam fees).
    faq: [
      { question: 'Do I need an IT background?', answer: 'No. Month 1 starts from cloud basics. If you are completely new to IT, a counsellor will suggest a short warm-up first.' },
      { question: 'How many hours a week?', answer: 'About 8 to 10: two or three live evening classes, plus labs in your own time.' }, // INVENTED
      { question: 'What if I miss a class?', answer: 'Every class is recorded and up the same night, and your mentor helps you catch up on the lab.' },
      { question: 'Do I get a certificate?', answer: 'Yes, a CEAP certificate employers can verify online. AWS, Azure and Google Cloud exam fees are paid to the exam provider.' },
      { question: 'Do you guarantee a job?', answer: 'No, and be wary of anyone who does. We give you the skills, a capstone, mock interviews, CV and LinkedIn help, and introductions.' },
    ],
  },
}
