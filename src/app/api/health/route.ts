import { json } from "@/lib/api";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return json({ storage: getStore().kind, hosted: !!process.env.VERCEL });
}
