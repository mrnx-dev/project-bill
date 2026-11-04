// Self-contained factory: jest hoists jest.mock above module scope, so no outer consts.
jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({ messageId: "msg-1" }) })),
}));
jest.mock("@/lib/prisma", () => ({ prisma: { settings: { findFirst: jest.fn() } } }));
jest.mock("@/lib/crypto", () => ({ decrypt: jest.fn(() => "s3cret") }));

import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import { sendMagicLinkEmail } from "@/lib/email";

const settings = (over: Record<string, unknown> = {}) => ({
  companyName: "ACME", companyEmail: null, companyLogoUrl: null, companyAddress: null,
  senderEmail: "billing@acme.test", ...over,
});
const link = [{ orgName: "ACME", url: "https://app.test/portal/x" }];

describe("sendMagicLinkEmail — SMTP transport", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());
  const spyLog = () => jest.spyOn(console, "log").mockImplementation(() => {});

  test("no SMTP config → mocked, transport never created", async () => {
    spyLog();
    (prisma.settings.findFirst as jest.Mock).mockResolvedValue(settings({ smtpHost: null }));

    const res = await sendMagicLinkEmail({ to: "c@x.test", clientName: "C", links: link, organizationId: "org1" });

    expect(res).toEqual({ success: true, mocked: true });
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    // settings belong to the calling org, never the first row in the table
    expect(prisma.settings.findFirst).toHaveBeenCalledWith({ where: { organizationId: "org1" } });
  });

  test("port 465 → secure transport with auth, from built from senderEmail", async () => {
    spyLog();
    (prisma.settings.findFirst as jest.Mock).mockResolvedValue(
      settings({ smtpHost: "mail.acme.test", smtpPort: "465", smtpUser: "billing@acme.test", smtpPass: "enc" }),
    );

    const res = await sendMagicLinkEmail({ to: "c@x.test", clientName: "C", links: link, organizationId: "org1" });

    expect(res).toEqual({ success: true });
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: "mail.acme.test", port: 465, secure: true,
      auth: { user: "billing@acme.test", pass: "s3cret" },
    });
    const sendMail = (nodemailer.createTransport as jest.Mock).mock.results[0].value.sendMail;
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: "ACME <billing@acme.test>",
      to: "c@x.test",
      subject: "Your Client Portal Login Link",
      html: expect.stringContaining("https://app.test/portal/x"),
    }));
  });

  test("blank port → 587, not secure", async () => {
    spyLog();
    (prisma.settings.findFirst as jest.Mock).mockResolvedValue(
      settings({ smtpHost: "mail.acme.test", smtpPort: "", smtpUser: "billing@acme.test", smtpPass: "enc" }),
    );

    await sendMagicLinkEmail({ to: "c@x.test", clientName: "C", links: link, organizationId: "org1" });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 587, secure: false }),
    );
  });
});