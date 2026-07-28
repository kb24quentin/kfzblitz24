"use server";

import { signOut } from "@/lib/auth";

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function signOutAdminAction() {
  await signOut({ redirectTo: "/admin/login" });
}

export async function signOutWorkshopAction() {
  await signOut({ redirectTo: "/login" });
}
