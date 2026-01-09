import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const gotham = localFont({
	src: [
		{
			path: "./fonts/gotham-thin.ttf",
			weight: "100",
			style: "normal",
		},
		{
			path: "./fonts/gotham-xlight.ttf",
			weight: "200",
			style: "normal",
		},
		{
			path: "./fonts/gotham-light.ttf",
			weight: "300",
			style: "normal",
		},
		{
			path: "./fonts/gotham-book.otf",
			weight: "400",
			style: "normal",
		},
		{
			path: "./fonts/gotham-medium.ttf",
			weight: "500",
			style: "normal",
		},
		{
			path: "./fonts/gotham-bold.ttf",
			weight: "700",
			style: "normal",
		},
		{
			path: "./fonts/gotham-black.ttf",
			weight: "800",
			style: "normal",
		},
		{
			path: "./fonts/gotham-ultra.ttf",
			weight: "900",
			style: "normal",
		},
	],
	variable: "--font-gotham",
});

export const metadata: Metadata = {
	title: "Voucher System",
	description: "Restaurant Voucher Management System",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
			</head>
			<body className={`${geistSans.variable} ${geistMono.variable} ${gotham.variable} antialiased`}>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<AuthProvider>
						{children}
						<Toaster />
					</AuthProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
