import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import { getConvexClient } from "@/lib/convex-server";
import { trackEvent } from "@/lib/error-tracking";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

type ContactSubmissionInput = {
  convexToken: string;
  subject: string;
  message: string;
  submissionId: string;
  userAgent?: string;
};

const storeContactSubmission = async ({
  convexToken,
  subject,
  message,
  submissionId,
  userAgent,
}: ContactSubmissionInput): Promise<void> => {
  const convex = getConvexClient();
  convex.setAuth(convexToken);
  await convex.mutation(api.users.storeContactSubmission, {
    subject,
    message,
    submissionId,
    userAgent,
  });
};

/**
 * Accept contact form submissions and log them for follow-up.
 */
export async function POST(request: Request) {
  try {
    const { userId, getToken } = await auth();
    const body = await request.json();
    const rawSubject = typeof body?.subject === "string" ? body.subject : "";
    const rawMessage = typeof body?.message === "string" ? body.message : "";
    const subject = rawSubject.trim();
    const message = rawMessage.trim();

    if (!subject || !message) {
      return NextResponse.json(
        { error: "Subject and message are required" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convexToken = await getToken({ template: "convex" });
    if (!convexToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const submissionId = randomUUID();
    const timestamp = new Date().toISOString();
    const userAgent = request.headers.get("user-agent") || undefined;

    await storeContactSubmission({
      convexToken,
      subject,
      message,
      submissionId,
      userAgent,
    });

    trackEvent("contact_submission_received", {
      metadata: {
        submissionId,
        subject,
        messageLength: message.length,
        timestamp,
        redacted: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Thank you for your message! This deployment logs submissions but does not send replies.",
    });
  } catch (error) {
    console.error("Failed to process contact form:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
