import bycrypt from "bcrypt";

export const hashPassword = (password: string) => {
  const hashed = bycrypt.hashSync(password, 10);
  return hashed;
};

export const comparePassword = (password: string, hashedPassword: string) => {
  return bycrypt.compareSync(password, hashedPassword);
};
