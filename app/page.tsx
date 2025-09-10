import { redirect } from "next/navigation";
import PageClient from "./PageClient";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function HomePage() {
  // ✅ await the client creation
  const supabase = await createServerSupabase();

  // ✅ now supabase is a SupabaseClient
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    redirect("/sign-in");
  }

  return <PageClient />;
}
