import { domainMapFromEnv } from '@educore/tenancy'

export const baseDomain = () => process.env.BASE_DOMAIN ?? 'localhost'
export const platformName = () => process.env.PLATFORM_NAME ?? 'EduCore'

/** Redis configured = the domain map is authoritative. */
export const isStrictDomainMap = () => Boolean(process.env.UPSTASH_REDIS_REST_URL)

export const domainMap = () => domainMapFromEnv()
