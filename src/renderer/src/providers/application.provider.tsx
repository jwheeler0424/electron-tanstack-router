import { ThemeProvider } from "@/providers/theme.provider";

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
