import { ThemeProvider } from "src/renderer/providers/theme.provider";

export default function ApplicationProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ThemeProvider>{children}</ThemeProvider>
    </>
  );
}
