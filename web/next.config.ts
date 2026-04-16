import type { NextConfig } from "next";

// basePath must match the GitHub Pages project path.
// Driven from GITHUB_REPOSITORY env in CI (e.g. "mattChrisP/DR-Arena-Test")
// so the same code builds correctly on the fork and on upstream.
// Falls back to "/DR-Arena-Test" for local builds.
const repoName =
  process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "DR-Arena-Test";
const basePath = process.env.NODE_ENV === "production" ? `/${repoName}` : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
