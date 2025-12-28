import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: ["@electric-sql/pglite", "drizzle-orm"],
    },
  },
  // build: {
  //   lib: {
  //     entry: "src/main/main.ts",
  //     fileName: "main",
  //     name: "main",
  //     // formats: ["umd"],
  //     // ...
  //   },
  // },
});
// import react from "@vitejs/plugin-react";
// import { readdirSync, statSync } from "node:fs";
// import path from "path";
// import { defineConfig } from "vite";
// import electron from "vite-plugin-electron";
// import { notBundle } from "vite-plugin-electron/plugin";
// import pkg from "./package.json";

// // https://vitejs.dev/config/
// export default defineConfig(({ command, mode }: any) => {
//   const isProduction = command === "build";
//   // rmSync("dist", { recursive: true, force: true });
//   // rmSync("dist-electron", { recursive: true, force: true });
//   return {
//     base: "./",
//     plugins: [
//       react(),
//       electron([
//         // main
//         {
//           // entry: './electron/main/index.ts', // 1
//           vite: {
//             plugins: [!isProduction && notBundle()],
//             build: {
//               // outDir: './dist-electron/main',   // 1
//               rollupOptions: {
//                 input: getEntries(path.resolve(__dirname, "src/main")), // 2
//                 output: {
//                   format: "cjs", // 2
//                   dir: "dist-electron/main",
//                   entryFileNames: "[name].js",
//                   chunkFileNames: "[name].js",
//                 },
//                 plugins: [
//                   // esmShim()
//                 ],
//                 external: Object.keys(pkg.dependencies),
//               },
//             },
//           },
//         },
//       ]),
//     ],
//     resolve: {
//       alias: {
//         "@/": path.resolve(__dirname, "./src"),
//         "@/common": path.resolve(__dirname, "./common"),
//       },
//     },
//   };
// });

// /**
//  * dir: main/db/index.ts
//  * return
//  * {
//  *   db/index: 'main/db/index.ts'
//  * }
//  * @param dir
//  * @returns
//  */
// const getEntries = (dir: string) => {
//   const entries: Record<string, string> = {};
//   const walk = (dirPath: string) => {
//     const files = readdirSync(dirPath);
//     files.forEach((file) => {
//       const fullPath = path.join(dirPath, file);
//       const stat = statSync(fullPath);

//       if (stat.isDirectory()) {
//         walk(fullPath);
//       } else if (file.endsWith(".ts") || file.endsWith(".js")) {
//         const relativePath = path.relative(dir, fullPath);
//         const name = relativePath.replace(/\.(ts|js)$/, "");
//         entries[name] = fullPath;
//       }
//     });
//   };
//   walk(dir);
//   return entries;
// };
