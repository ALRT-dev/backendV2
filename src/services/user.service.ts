import prisma from "../utils/prisma_client.util.js";

/// Retrieves a user by their ID, excluding sensitive information like password hash.
export const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    omit: { passwordHash: true },
  });
  return user;
};
