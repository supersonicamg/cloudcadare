import { notFound } from 'next/navigation'

// notFound() leaves nothing to prefetch, so there is nothing to validate for instant navigation.
export const instant = false

/** Any address no other route matches shows the academy's own "page not found", not the framework's blank one. */
export default function Missing() {
  notFound()
}
