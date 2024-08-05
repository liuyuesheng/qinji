const jwt = require("jsonwebtoken");
export function generateRandomString(length: number): string {
  const charset = "abcdefghijklmnopqrtuvwxyzABCDEFGHIJKLMNOPQRTUVWXYZ012356789";
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    result += charset[randomIndex];
  }
  return result;
}
const SK = "a69c69";
export function createToken(count: number, day: number) {
  const key = generateRandomString(20);
  const expires = `${day}d`;
  const token = jwt.sign(
    {
      key: key,
      count: count,
    },
    SK,
    { expiresIn: expires },
    { algorithm: "HS256" },
  );
  console.log(`createToken:${token}`);
  return token;
}

export function decodeToken(token: string): any {
  console.log(`decodeToken:${token}`);
  return jwt.verify(token, SK);
}
