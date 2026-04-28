export const ReactKit = {
  React: "react",
  ReactDOM: "react-dom",
  Router: "react-router-dom",
  Framer: "framer-motion",
  Query: "@tanstack/react-query",
  HookForm: "react-hook-form",
  Lucide: "lucide-react",
};

export const DataScience = {
  Pandas: "danfojs-node",
  Plotly: "plotly.js",
  D3: "d3",
  Math: "mathjs",
  TF: "@tensorflow/tfjs-node",
};

export const BackendKit = {
  Express: "express",
  Fastify: "fastify",
  Prisma: "@prisma/client",
  Mongoose: "mongoose",
  Zod: "zod",
  JWT: "jsonwebtoken",
  Bcrypt: "bcryptjs",
};

export const FrontendKit = {
  Tailwind: "tailwindcss",
  Motion: "framer-motion",
  Three: "three",
  GSAP: "gsap",
};

export function registerBundle(entirety, bundle) {
  entirety.register(bundle);
}
