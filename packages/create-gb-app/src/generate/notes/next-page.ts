// The Next Notes page of a server backend; NotesClient talks to the server.
export const NEXT_SERVER_NOTES_PAGE = `import Link from "next/link";
import { NotesClient } from "./notes-client";

export default function NotesPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Notes</h1>
      <Link className="text-sm underline" href="/">
        Home
      </Link>
      <NotesClient />
    </main>
  );
}
`;
