import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import { getConvexClient } from "@/lib/convex-server";

export const runtime = "nodejs";

/**
 * Accept contact form submissions and log them for follow-up.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    const body = await request.json();
    const { subject, message } = body;

    if (!subject || !message) {
      return NextResponse.json(
        { error: "Subject and message are required" },
        { status: 400 }
      );
    }

    let userEmail = "anonymous@user";
    let userName = "Anonymous User";
    
    if (userId) {
      const convex = getConvexClient();
      const user = await convex.query(api.users.getUserByClerkUserId, {
        clerkUserId: userId,
      });
      if (user) {
        userEmail = user.email;
        userName = user.preferredName || userEmail.split("@")[0];
      }
    }

    console.log("Contact form submission:", {
      userEmail,
      userName,
      subject,
      message: message.substring(0, 200) + (message.length > 200 ? "..." : ""),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Thank you for your message! We'll get back to you soon.",
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
