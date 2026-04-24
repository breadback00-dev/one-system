import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing(.*)",
  "/demo(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  // App routes are accessible without auth — unauthenticated users see the
  // demo workspace via getCurrentWorkspace(). Sign-up creates a private workspace.
  "/dashboard(.*)",
  "/reactivation(.*)",
  "/leads(.*)",
  "/reviews(.*)",
  "/ads(.*)",
  "/sales(.*)",
  "/platform(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
