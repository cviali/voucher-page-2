import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	images: {
		unoptimized: true,
		remotePatterns: [
			{
				protocol: "https",
				hostname: "tch-api.vlocityarena.com",
				pathname: "/vouchers/image/**",
			},
		],
	},
};

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();

export default nextConfig;
