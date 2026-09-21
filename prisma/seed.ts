import { seedDemoData } from "../lib/seed";
import { prisma } from "../lib/prisma";

async function main() {
  await seedDemoData();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
