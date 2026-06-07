import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <SignUp signInUrl="/sign-in" />
    </div>
  );
}
