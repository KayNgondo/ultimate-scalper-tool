import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PageClient from "./PageClient";

export default async function HomePage() {
  // 👇 IMPORTANT: await if your helper is async
  const supabase = await createServerSupabase();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/sign-in");
  }

  // If you need to pass server data to the client, do it via props to PageClient
  return <PageClient />;
}
