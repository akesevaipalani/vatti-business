import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  try {
    const profile = await prisma.businessProfile.findUnique({
      where: { id: "default-biz" },
    });

    if (!profile || !profile.isSetupDone) {
      redirect("/setup");
    }
  } catch (error) {
    console.warn("HomePage profile check fallback:", error);
  }

  redirect("/dashboard");
}

