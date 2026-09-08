import { redirect } from "next/navigation";

export default function Home() {
  // O painel decide: sem sessao, ele proprio manda para /login.
  redirect("/dashboard");
}
