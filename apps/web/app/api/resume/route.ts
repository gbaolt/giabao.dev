import { connection } from 'next/server';

import { RESUME_PDF_FILENAME } from '@/config/resume';
import { getDevelopmentResumePdf } from '@/features/resume/lib/development-resume-pdf';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return new Response(null, { status: 404 });
  }

  await connection();

  const pdf = await getDevelopmentResumePdf();

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${RESUME_PDF_FILENAME}"`,
      'Cache-Control': 'no-store',
    },
  });
}
