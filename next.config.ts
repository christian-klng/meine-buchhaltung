import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ein schlankes, eigenständiges Artefakt für den Docker-/Coolify-Build.
  output: "standalone",
  // Server-only Pakete nicht ins Client-Bundle ziehen.
  serverExternalPackages: ["@prisma/adapter-pg", "pg", "unpdf"],
};

export default nextConfig;
