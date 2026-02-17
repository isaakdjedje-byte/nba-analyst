import { LoginForm } from "@/components/auth/LoginForm";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth/auth-options";
import { redirect } from "next/navigation";

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Check if user is already authenticated
  const session = await getServerSession(authOptions);
  const params = await searchParams;

  if (session) {
    // Redirect to callback URL or dashboard
    redirect(params.callbackUrl || "/dashboard/picks");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
            NBA Analyst
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Plateforme de décision pour paris sportifs NBA
          </p>
        </div>
        <LoginForm callbackUrl={params.callbackUrl} />
      </div>
    </div>
  );
}
