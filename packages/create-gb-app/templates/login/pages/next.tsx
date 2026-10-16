'use client';
import { useRouter } from 'next/navigation';
import { GalleryVerticalEnd } from 'lucide-react';
import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  const router = useRouter();
  return (
    <main className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2 self-center font-medium">
          <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-4" />
          </span>
          {__PROJECT_NAME__}
        </div>
        <LoginForm
          onSuccess={() => {
            router.push('/notes');
            router.refresh();
          }}
        />
      </div>
    </main>
  );
}
