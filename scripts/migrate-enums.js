const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Starting migration to UPPERCASE ENUM values...");

  // Project.status
  console.log("Migrating Project.status...");
  const projects = await prisma.project.findMany();
  for (const project of projects) {
    if (project.status && project.status !== project.status.toUpperCase()) {
      await prisma.project.update({
        where: { id: project.id },
        data: { status: project.status.toUpperCase() },
      });
    }
    if (project.language && project.language !== project.language.toUpperCase()) {
        await prisma.project.update({
            where: { id: project.id },
            data: { language: project.language.toUpperCase() },
        });
    }
  }

  // Invoice.status, Invoice.type, Invoice.emailStatus
  console.log("Migrating Invoice fields...");
  const invoices = await prisma.invoice.findMany();
  for (const invoice of invoices) {
    const updates = {};
    if (invoice.status && invoice.status !== invoice.status.toUpperCase()) {
      updates.status = invoice.status.toUpperCase();
    }
    if (invoice.type && invoice.type !== invoice.type.toUpperCase()) {
      updates.type = invoice.type.toUpperCase();
    }
    if (invoice.emailStatus && invoice.emailStatus !== invoice.emailStatus.toUpperCase()) {
      updates.emailStatus = invoice.emailStatus.toUpperCase();
    }
    if (Object.keys(updates).length > 0) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: updates,
      });
    }
  }

  // User.role
  console.log("Migrating User.role...");
  const users = await prisma.user.findMany();
  for (const user of users) {
    if (user.role && user.role !== user.role.toUpperCase()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: user.role.toUpperCase() },
      });
    }
  }

  // RecurringInvoice.frequency
  console.log("Migrating RecurringInvoice.frequency...");
  const recurringInvoices = await prisma.recurringInvoice.findMany();
  for (const ri of recurringInvoices) {
    if (ri.frequency && ri.frequency !== ri.frequency.toUpperCase()) {
      await prisma.recurringInvoice.update({
        where: { id: ri.id },
        data: { frequency: ri.frequency.toUpperCase() },
      });
    }
  }

  // Notification.type
  console.log("Migrating Notification.type...");
  const notifications = await prisma.notification.findMany();
  for (const n of notifications) {
    if (n.type && n.type !== n.type.toUpperCase()) {
      await prisma.notification.update({
        where: { id: n.id },
        data: { type: n.type.toUpperCase() },
      });
    }
  }

  // Subscription.plan and Subscription.status
  console.log("Migrating Subscription fields...");
  const subscriptions = await prisma.subscription.findMany();
  for (const sub of subscriptions) {
    const updates = {};
    if (sub.plan && sub.plan !== sub.plan.toUpperCase()) {
      updates.plan = sub.plan.toUpperCase();
    }
    if (sub.status && sub.status !== sub.status.toUpperCase()) {
      updates.status = sub.status.toUpperCase();
    }
    if (Object.keys(updates).length > 0) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: updates,
      });
    }
  }

  console.log("Migration completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error migrating enums:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
