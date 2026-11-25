import type { Staff } from './session'

/** Who may change an academy (features, suspend). Everyone else in the console can look. */
export const canManageAcademies = (role: Staff['role']) => role === 'owner' || role === 'admin'
