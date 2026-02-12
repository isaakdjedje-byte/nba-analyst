export const metadata = {
  title: 'NBA Analyst',
  description: 'AI-powered sports betting decision platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
