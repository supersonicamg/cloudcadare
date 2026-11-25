'use client'
import { createContext, useContext, type ReactNode } from 'react'
import { isEnabled, type FeatureKey, type FeatureSnapshot } from './index'

const FeatureContext = createContext<FeatureSnapshot>({})

export function FeatureProvider({ snapshot, children }: { snapshot: FeatureSnapshot; children: ReactNode }) {
  return <FeatureContext.Provider value={snapshot}>{children}</FeatureContext.Provider>
}

export function useFeatures(): FeatureSnapshot {
  return useContext(FeatureContext)
}

export function useFeature(key: FeatureKey): boolean {
  return isEnabled(useContext(FeatureContext), key)
}

/** UI gate only. The server and the database enforce the same rule. */
export function Feature({ name, children, fallback = null }: { name: FeatureKey; children: ReactNode; fallback?: ReactNode }) {
  return useFeature(name) ? <>{children}</> : <>{fallback}</>
}
