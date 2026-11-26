import { PageLoading } from "./_components/PageLoading";

/* Suspense fallback for every route segment (replaces the old app-wide
   <Suspense fallback={null}>, which left the page blank until hydration). */
export default function Loading() {
  return <PageLoading />;
}
