'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActionAccess } from '@/lib/dal'

export async function revokeCertificate(id: string, form: FormData): Promise<void> {
  if (!z.uuid().safeParse(id).success) return
  const reason = z.string().trim().max(300).safeParse(form.get('reason') ?? '')
  const a = await requireActionAccess({ permission: 'certificate.manage', feature: 'learning.certificates' })
  const { error } = await a.db.rpc('revoke_certificate', { p_certificate_id: id, p_reason: reason.success ? reason.data : '' })
  if (error) throw new Error('could not revoke the certificate')
  revalidatePath('/admin/certificates')
}
