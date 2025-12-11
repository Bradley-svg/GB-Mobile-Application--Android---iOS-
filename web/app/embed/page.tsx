import { redirect } from "next/navigation";

export default function EmbedRoute() {
  redirect("/app?embed=true");
}
