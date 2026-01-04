import bcrypt from "bcryptjs";
const saltRounds = 10;

export const hashPassword = (value: string): string => {
  return bcrypt.hashSync(value, saltRounds);
};

export const verifyPassword = (
  password: string,
  hashedPassword: string
): boolean => {
  return bcrypt.compareSync(password, hashedPassword);
};
