import prisma from "../utils/prisma_client.util.js";

export const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    omit: { passwordHash: true },
  });
  return user;
};
