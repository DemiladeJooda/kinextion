import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Routes that require a session.
 *
 * Everything else stays public — the marketing site, the legal pages and the
 * two AI edge routes. Listing what's protected rather than what's open means
 * a new marketing page can't accidentally end up behind a login wall.
 */
const isProtected = createRouteMatcher(["/dashboard(.*)", "/community(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (!isProtected(request)) return;

  /**
   * Send a signed-out visitor to sign-in, and back here afterwards.
   *
   * `auth.protect()` on its own answers 404 for a page route, which is a
   * worse outcome than the problem this route was added to solve — someone
   * follows a link to their dashboard, isn't signed in, and is told the page
   * doesn't exist. `unauthenticatedUrl` makes it a redirect, and carrying the
   * original URL means they land where they were going rather than on the
   * marketing page.
   */
  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("redirect_url", request.url);

  await auth.protect({ unauthenticatedUrl: signIn.toString() });
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
