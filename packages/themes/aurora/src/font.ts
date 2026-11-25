import { Schibsted_Grotesk } from 'next/font/google'

// One family for headings and text. Variable font, so every weight the design uses (400 to 800) is one file.
export const schibsted = Schibsted_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-schibsted' })
