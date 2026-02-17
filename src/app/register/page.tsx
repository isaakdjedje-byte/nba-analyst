import { RegisterForm } from "@/components/auth/RegisterForm";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth/auth-options";
import { redirect } from "next/navigation";

export default async function RegisterPage() {
  // Check if user is already authenticated
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard/picks");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
            NBA Analyst
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Créez votre compte pour accéder à la plateforme
          </p>
        </div>
        <RegisterForm callbackUrl="/login" />
      </div>
    </div>
  );
}
