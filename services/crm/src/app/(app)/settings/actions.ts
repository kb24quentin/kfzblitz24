"use server";

import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

export async function createUser(formData: FormData) {
  const password = formData.get("password") as string;
  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: hashedPassword,
      role: (formData.get("role") as string) || "user",
    },
  });

  revalidatePath("/settings");
}

export async function updateUser(formData: FormData) {
  const id = formData.get("id") as string;
  const data: Record<string, string> = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    role: (formData.get("role") as string) || "user",
  };

  const password = formData.get("password") as string;
  if (password && password.length >= 6) {
    data.password = await bcrypt.hash(password, 12);
  }

  await prisma.user.update({ where: { id }, data });
  revalidatePath("/settings");
}

export async function toggleUserActive(formData: FormData) {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";

  await prisma.user.update({
    where: { id },
    data: { active },
  });

  revalidatePath("/settings");
}
