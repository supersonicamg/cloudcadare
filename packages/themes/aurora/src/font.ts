import { Hanken_Grotesk } from 'next/font/google'

// One family, two weights (plan/15 §6): 400 for text and 600 for everything that carries weight. Nothing else is loaded.
export const hanken = Hanken_Grotesk({ subsets: ['latin'], weight: ['400', '600'], display: 'swap', variable: '--font-hanken' })
