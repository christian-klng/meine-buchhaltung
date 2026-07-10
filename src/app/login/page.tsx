import { LoginForm } from "./login-form";
import { safeRedirectPath } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <LoginForm from={safeRedirectPath(from)} />
    </div>
  );
}
