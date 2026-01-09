import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	images: {
		unoptimized: true,
	},
};

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();

export default nextConfig;
