import { redirect } from "next/navigation";

export default function LegacyPaymentsRedirect() {
  redirect("/painel/pagamentos");
}
