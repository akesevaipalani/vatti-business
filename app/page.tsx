import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const profile = await prisma.businessProfile.findUnique({
    where: { id: "default-biz" },
  });

  if (!profile || !profile.isSetupDone) {
    redirect("/setup");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  redirect("/dashboard");
}
