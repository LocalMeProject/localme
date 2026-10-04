import { NextResponse } from "next/server";
import { verifyZarinpalPayment } from "@/lib/server/zarinpal";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const authority = url.searchParams.get("Authority") || url.searchParams.get("authority") || "";
  const status = url.searchParams.get("Status") || url.searchParams.get("status") || "";

  if (!authority) {
    return NextResponse.redirect(new URL("/account?payment=failed&msg=Authority+missing", url.origin));
  }

  try {
    const result = await verifyZarinpalPayment({ authority, status });
    if (result.success) {
      return NextResponse.redirect(
        new URL(`/account?payment=success&refId=${encodeURIComponent(result.refId || "")}`, url.origin),
      );
    } else {
      return NextResponse.redirect(
        new URL(`/account?payment=failed&msg=${encodeURIComponent(result.message)}`, url.origin),
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Verification error";
    return NextResponse.redirect(
      new URL(`/account?payment=failed&msg=${encodeURIComponent(msg)}`, url.origin),
    );
  }
}
