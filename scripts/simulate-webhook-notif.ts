import { prisma } from "../src/lib/prisma";
import crypto from "crypto";

// Simulation script to test if injecting webhook creates notification
async function runSimulation() {
  console.log("Starting Webhook Notification Simulation...");

  // Pastikan ada organisasi untuk mengaitkan data tenant
  const org = await prisma.organization.findFirst()
    ?? await prisma.organization.create({ data: { name: "Seed Org", slug: "seed-org" } });

  // 1. Create a dummy client and project
  const client = await prisma.client.create({
    data: { name: "Test Client QA", email: "qa@example.com", organizationId: org.id }
  });

  const project = await prisma.project.create({
    data: { clientId: client.id, title: "QA Webhook Notif Project", totalPrice: 1000, organizationId: org.id }
  });

  // 2. Create an unpaid invoice
  const invoice = await prisma.invoice.create({
    data: {
      projectId: project.id,
      amount: 1000,
      type: "full_payment",
      status: "unpaid",
      organizationId: org.id,
    }
  });

  console.log(`Created Invoice: ${invoice.id} for Project: ${project.title}`);

  // 3. Simulate the webhook call by hitting the internal route logic (we'll just use the raw endpoint using fetch)
  // For doing that locally, we'll construct the webhook payload
  const payload = JSON.stringify({
    event: "payment.success",
    data: {
      reference_id: invoice.id,
      id: "mayar_txn_test_123"
    }
  });

  const secret = process.env.MAYAR_WEBHOOK_SECRET || "test_secret";
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  // We need to fetch against the running dev server
  console.log("Sending simulated webhook to http://localhost:3000/api/webhooks/mayar");
  try {
    const res = await fetch("http://localhost:3000/api/webhooks/mayar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-mayar-signature": signature
      },
      body: payload
    });

    console.log("Webhook Response:", res.status, await res.text());

    // 4. Verify the notification was created
    // Wait a brief moment for async notification creation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const notifs = await prisma.notification.findMany({
      where: { linkUrl: `/invoices/${invoice.id}` }
    });

    if (notifs.length > 0) {
      console.log("✅ SUCCESS: Notification found in DB!", notifs[0]);
    } else {
      console.error("❌ FAILURE: No notification found in DB for this invoice.");
    }

  } catch (err) {
    console.error("Simulation failed. Make sure the dev server is running on port 3000.", err);
  }

  // Cleanup
  await prisma.invoice.deleteMany({ where: { projectId: project.id } });
  await prisma.project.deleteMany({ where: { id: project.id } });
  await prisma.client.deleteMany({ where: { id: client.id } });
  console.log("Cleanup done.");
}

runSimulation()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
