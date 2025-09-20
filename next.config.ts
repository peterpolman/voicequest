import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    MODEL: process.env.MODEL,
    SUMMARY_MODEL: process.env.SUMMARY_MODEL,
  },
};

export default nextConfig;
